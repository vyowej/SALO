<?php

namespace App\Http\Controllers\Api\V1\Business;

use App\Http\Controllers\Controller;
use App\Http\Requests\Business\BusinessReportRequest;
use App\Http\Resources\BusinessReportResource;
use App\Models\Restaurant;
use App\Services\BusinessReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class BusinessReportController extends Controller
{
    public function show(
        BusinessReportRequest $request,
        string $report,
        BusinessReportService $service,
    ): JsonResponse {
        $restaurant = $this->restaurant($request);
        $this->authorize('viewReport', [$restaurant, $report]);
        $result = $service->report($restaurant, $report, $request->validated());

        return BusinessReportResource::make($result)->response();
    }

    public function export(
        BusinessReportRequest $request,
        string $report,
        BusinessReportService $service,
    ): StreamedResponse {
        $restaurant = $this->restaurant($request);
        $this->authorize('viewReport', [$restaurant, $report]);
        $result = $service->report($restaurant, $report, $request->validated());
        $filename = $report.'-'.$request->validated('from').'-'.$request->validated('to').'.csv';

        return response()->streamDownload(function () use ($result): void {
            $output = fopen('php://output', 'w');
            if ($output === false) {
                throw new \RuntimeException('Unable to open the report stream.');
            }
            fputcsv($output, $result['columns'], ',', '"', '');
            foreach ($result['rows'] as $row) {
                $values = array_map(fn (string $column): mixed => $this->csvValue($row[$column] ?? ''), $result['columns']);
                fputcsv($output, $values, ',', '"', '');
            }
            fclose($output);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    private function csvValue(mixed $value): mixed
    {
        if (is_string($value) && preg_match('/^[=+\-@\t\r]/', $value) === 1) {
            return "'".$value;
        }

        return $value;
    }

    private function restaurant(Request $request): Restaurant
    {
        $restaurant = $request->attributes->get('restaurant');
        abort_unless($restaurant instanceof Restaurant, 404);

        return $restaurant;
    }
}
