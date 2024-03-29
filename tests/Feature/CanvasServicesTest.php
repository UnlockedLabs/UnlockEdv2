<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Enrollment;
use App\Models\ProviderPlatform;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Tests\MockIntegrations\MockCanvasServices;
use Tests\TestCase;

class CanvasServicesTest extends TestCase
{
    use RefreshDatabase;

    public $seeder = \Database\Seeders\TestSeeder::class;

    /**
     * this tests the current action implemented at /actions/register-canvas-auth-provider
     */
    public function test_list_authproviders(): void
    {
        $this->seed($this->seeder);
        $cs = new MockCanvasServices();
        // This provides a mock response of creating a new auth provider
        $course = Course::factory()->withResourceId(4)->createOne();
        $provider = ProviderPlatform::factory()->createOne();
        $resp = $cs->listAuthenticationProviders();
        $prov = $resp[0];
        $auth_provider_id = $prov['id'];
        $provider->external_auth_provider_id = $auth_provider_id;
        $provider->update(['external_auth_provider_id' => $auth_provider_id]);
        $provider->save();
        $this->assertDatabaseHas('provider_platforms', ['external_auth_provider_id' => $auth_provider_id]);
    }

    // this tests the current action implemented at /actions/store-user-enrollments
    public function testStoreEnrollments()
    {
        $this->seed($this->seeder);
        $user = User::factory()->createOne();
        $provider = ProviderPlatform::factory()->createOne();

        $canvasService = new MockCanvasServices();
        $canvasEnrollments = $canvasService->listEnrollmentsForUser();
        $course = Course::factory()->forProviderPlatform($provider->id)->withResourceId(4)->createOne();
        $enrollmentCollection = collect();
        $request = new Request();
        foreach ($canvasEnrollments as $enrollment) {
            if ($course = Course::where('external_resource_id', $enrollment['course_id'])->firstOrFail()) {
                $request->merge([
                    'user_id' => $user->id,
                    'course_id' => $course->id,
                    'external_enrollment_id' => $enrollment['id'],
                    'enrollment_state' => $enrollment['enrollment_state'],
                    'external_start_at' => $enrollment['start_at'],
                    'external_end_at' => $enrollment['end_at'],
                    'external_link_url' => $enrollment['html_url'],
                ]);
                $validated = $request->validate([
                    'user_id' => 'required|exists:users,id',
                    'course_id' => 'required|exists:courses,id',
                    'enrollment_state' => 'nullable|in:active,inactive,completed,deleted',
                    'external_enrollment_id' => 'required|max:255',
                    'external_start_at' => 'nullable|date',
                    'external_end_at' => 'nullable|date|after_or_equal:external_start_at',
                    'external_link_url' => 'nullable|url|max:255',
                ]);
                $enrollmentCollection->push(Enrollment::create($validated));
            }
        }
        // ensure enrollments were stored properly
        $response = $this->actingAs($user)->getJson('api/v1/enrollments');
        $this->assertJson($response->content());
        $response->assertJsonStructure([
            'data' => [
                '*' => [
                    'id',
                    'user_id',
                    'course_id',
                    'external_enrollment_id',
                    'enrollment_state',
                    'external_start_at',
                    'external_end_at',
                    'external_link_url',
                ],
            ],
        ]);
    }
}
