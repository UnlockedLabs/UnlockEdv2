<?php

declare(strict_types=1);

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

    // fallback to the only provider usr mapping should the argument be null
    public function externalIdFor(?int $provider_platform_id): ?string
    {
        return $provider_platform_id ? $this->providerUserMappings()
            ->where('provider_platform_id', $provider_platform_id)
            ->value('external_user_id') : $this->providerUserMappings()->sole()->external_user_id;
    }

    public function mapToProvider(int $provider_platform_id, int $external_user_id)
    {
        $default_ext_username = $this->attributes['email'] != null ?
            $this->attributes['email'] :
            $this->attributes['username'].'@unlockEd.v2';
        $this->providerUserMappings()
            ->create([
                'provider_platform_id' => $provider_platform_id,
                'external_user_id' => $external_user_id,
                'external_username' => $default_ext_username,
            ]);
    }

    public function userCourseActivity()
    {
        return $this->hasMany('App\Models\UserCourseActivity');
    }

    public function providerUserMappings()
    {
        return $this->hasMany('App\Models\ProviderUserMapping');
    }

    public function isAdmin(): bool
    {
        return $this->role === UserRole::ADMIN;
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
