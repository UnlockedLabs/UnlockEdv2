<?php

namespace App\Models;

use App\Enums\ProviderPlatformState;
use App\Enums\ProviderPlatformType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;

class ProviderPlatform extends Model
{
    use HasFactory;

    protected $fillable = [
        'type',
        'name',
        'description',
        'icon_url',
        'account_id',
        'access_key',
        'base_url',
        'state',
        'external_auth_provider_id',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'type' => ProviderPlatformType::class,
        'state' => ProviderPlatformState::class,
    ];

    public function encryptAccessKey(string $value)
    {
        $this->attributes['access_key'] = Crypt::encryptString($value);
    }

    public function decryptAccessKey()
    {
        return Crypt::decryptString($this->attributes['access_key']);
    }

    public function getProviderServices(): \App\Services\ProviderServices
    {
        return match ($this->attributes['type']) {
            'kolibri' => new \App\Services\KolibriServices($this->attributes['id'], $this->attributes['account_id'], $this->attributes['access_key'], $this->attributes['base_url']),
            default => new \App\Services\CanvasServices($this->attributes['id'], $this->attributes['account_id'], $this->attributes['access_key'], $this->attributes['base_url']),
        };
    }

    public function hasUserMapping($user)
    {
        return $this->providerUserMappings()->where('user_id', $user->id)->exists();
    }

    public function providerUserMappings()
    {
        return $this->hasMany('\App\Models\ProviderUserMapping');
    }
}
