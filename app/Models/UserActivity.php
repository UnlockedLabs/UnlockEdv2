<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class UserActivity extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'browser_name',
        'platform',
        'device',
        'ip',
        'clicked_url',
    ];

    // protected $hidden = [
    //     'ip',
    // ];
}
