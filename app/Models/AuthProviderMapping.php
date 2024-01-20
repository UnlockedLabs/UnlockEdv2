<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AuthProviderMapping extends Model
{
    use HasFactory;

    protected $fillable = [
        'provider_platform_id',
        'authentication_provider_id',
        'authentication_type',
    ];

    public function providerPlatform()
    {
        return $this->belongsTo(ProviderPlatform::class);
    }
}
