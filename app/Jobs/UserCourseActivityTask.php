<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Enums\ProviderPlatformState;
use App\Enums\UserRole;
use App\Models\Enrollment;
use App\Models\ProviderPlatform;
use App\Models\User;
use App\Models\UserCourseActivity;
use DateTimeImmutable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Class UserCourseActivityTask
 *
 * Currently this will fetch from canvas, but will be added to
 * in the future to include other platforms
 */
class UserCourseActivityTask implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected $users;

    protected $providers;

    /**
     * Create a new job instance.
     */
    public function __construct()
    {
        $this->users = User::where('role', UserRole::STUDENT)->get();
        $this->providers = ProviderPlatform::where('state', ProviderPlatformState::ENABLED)->get();
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        foreach ($this->providers as $provider) {
            $cs = $provider->getProviderServices();
            foreach ($this->users as $user) {
                $enrollments = Enrollment::where('user_id', $user->id)
                    ->whereHas('course', function ($query) use ($provider) {
                        $query->where('provider_platform_id', $provider->id);
                    })
                    ->get();

                foreach ($enrollments as $entry) {
                    $entry = $cs->getEnrollmentById((int) $entry->external_enrollment_id);
                    $total_activity = $entry['total_activity_time'];
                    if ($total_activity == 0) {
                        continue;
                    }
                    $last_activity = $entry['last_activity_at'];
                    $now = new DateTimeImmutable('now');
                    $difference = $now->diff(new DateTimeImmutable($last_activity), true);
                    $had_activity = false;
                    if ($difference->days < 1) {
                        $had_activity = true;
                    }
                    $enrollment_id = $entry['id'];
                    UserCourseActivity::create([
                        'user_id' => $user->id,
                        'enrollment_id' => $enrollment_id,
                        'has_activity' => $had_activity,
                        'total_activity' => $total_activity,
                    ]);
                }
            }
        }
    }
}
