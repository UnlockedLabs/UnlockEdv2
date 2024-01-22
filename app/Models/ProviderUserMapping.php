<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProviderUserMapping extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'provider_platform_id',
        'external_user_id',
        'external_username', // if the user has a field in the external platform that is different from 'username'
        'authentication_provider_id',
    ];  // in the case of canvas, this will be 'openid_connect'

}
