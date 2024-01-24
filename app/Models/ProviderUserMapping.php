<?php

namespace App\Models;

use App\Enums\AuthProviderType;
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
    ];

    protected $casts = [
        'authentication_provider_id' => AuthProviderType::class,
    ];

    public function user()
    {
        return $this->belongsTo('App\Models\User');
    }

    public function providerPlatform()
    {
        return $this->belongsTo('App\Models\ProviderPlatform');
    }
}
