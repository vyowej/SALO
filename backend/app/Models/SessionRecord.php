<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SessionRecord extends Model
{
    protected $table = 'sessions';

    protected $primaryKey = 'id';

    public $incrementing = false;

    protected $keyType = 'string';

    public $timestamps = false;
}
