<?php

declare(strict_types=1);

namespace App\Providers;

use App\Jobs\UserCourseActivityTask;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->app->bindMethod([UserCourseActivityTask::class, 'handle'], function ($job, $app) {
            return $job->handle();
        });
    }
}
