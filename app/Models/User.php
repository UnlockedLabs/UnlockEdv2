<?php

declare(strict_types=1);

namespace App\Models;

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

    /**
     * Get the user's external ID in the specified provider platform.
     * If no provider platform ID is provided, and there is exactly one mapping, it returns that one.
     * Otherwise, it returns null or throws a custom exception if there are multiple/no mappings when no ID is provided.
     */
    public function externalIdFor(?int $provider_platform_id): ?string
    {
        if ($provider_platform_id !== null) {
            // Fetch external ID for the specified platform
            return $this->providerUserMappings()
                ->where('provider_platform_id', $provider_platform_id)
                ->value('external_user_id');
        } else {
            try {
                return $this->providerUserMappings()->sole()->external_user_id;
            } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
                return null;
            }
        }
    }

    /**
     * Map the user to the specified provider platform.
     */
    public function mapToProvider(int $provider_platform_id, int $external_user_id): void
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

    /**
     * Course Activity for the user.
     *
     * @return \Illiminate\Database\Eloquent\Relations\HasMany
     */
    public function userCourseActivity(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany('\App\Models\UserCourseActivity');
    }

    /**
     *  Provider user mappings for the user.
     */
    public function providerUserMappings(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany('\App\Models\ProviderUserMapping');
    }

    /**
     * Check if the user has the role of admin.
     */
    public function isAdmin(): bool
    {
        return $this->role === UserRole::ADMIN;
    }

    /**
     * Check if the user has the role of student.
     *
     * @return bool
     */
    public function userActivity(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany('\App\Models\UserActivity');
    }

    /**
     * Set the users password to a random string and return it.
     */
    public function createTempPassword(): string
    {
        $pw = Str::random(8);
        $this->attributes['password'] = Hash::make($pw);
        $this->attributes['password_reset'] = true;
        $this->save();

        return $pw;
    }
}
