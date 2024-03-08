<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Enums\UserRole;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Passport\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'username',
        'email',
        'name_first',
        'name_last',
        'password',
        'password_reset',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'role' => UserRole::class,
    ];

    public function externalIdFor(int $provider_platform_id): ?int
    {
        return $this->providerUserMappings()
            ->where('provider_platform_id', $provider_platform_id)
            ->value('external_user_id');
    }

    public function providerUserMappings()
    {
        return $this->hasMany('App\Models\ProviderUserMapping');
    }

    public function isAdmin(): bool
    {
        return $this->role === UserRole::Admin;
    }

    public function userActivity()
    {
        return $this->hasMany('App\Models\UserActivity');
    }

    public function createTempPassword()
    {
        $pw = Str::random(8);
        $this->attributes['password'] = Hash::make($pw);
        $this->attributes['password_reset'] = true;
        $this->save();

        return $pw;
    }
}
