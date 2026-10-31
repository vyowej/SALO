<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;

class CachePsgcApi extends Command
{
    protected $signature = 'psgc:cache-api {--path= : Directory for the local PSGC JSON cache}';

    protected $description = 'Download and cache the PSGC API datasets locally without importing them';

    private const DATASETS = [
        'regions.json' => 'https://psgc.gitlab.io/api/regions/',
        'provinces.json' => 'https://psgc.gitlab.io/api/provinces/',
        'cities-municipalities.json' => 'https://psgc.gitlab.io/api/cities-municipalities/',
        'barangays.json' => 'https://psgc.gitlab.io/api/barangays/',
    ];

    public function handle(): int
    {
        $directory = $this->option('path') ?: storage_path('app/psgc-cache');
        File::ensureDirectoryExists($directory);

        $downloads = [];
        foreach (self::DATASETS as $filename => $url) {
            $response = Http::acceptJson()
                ->timeout(60)
                ->retry(2, 1000)
                ->get($url)
                ->throw();
            $records = $response->json();

            if (! is_array($records) || ! array_is_list($records) || $records === []) {
                $this->error("The PSGC endpoint returned an invalid dataset: {$url}");

                return self::FAILURE;
            }

            $downloads[$filename] = json_encode(
                $records,
                JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR,
            );
        }

        foreach ($downloads as $filename => $contents) {
            $path = rtrim($directory, DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR.$filename;
            $temporaryPath = $path.'.tmp';
            if (file_put_contents($temporaryPath, $contents, LOCK_EX) === false
                || ! rename($temporaryPath, $path)) {
                if (is_file($temporaryPath)) {
                    unlink($temporaryPath);
                }
                $this->error("Unable to write the PSGC cache file: {$path}");

                return self::FAILURE;
            }
        }

        $this->info('Cached '.count($downloads).' PSGC datasets in '.$directory.'. No database import was performed.');

        return self::SUCCESS;
    }
}
