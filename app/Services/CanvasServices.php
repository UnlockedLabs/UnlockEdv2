<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Course;
use App\Models\ProviderPlatform;
use App\Models\User;
use GuzzleHttp\Client;
use Illuminate\Support\Facades\App;

/**
 * Class CanvasServices
 * constants for canvas API routes
 */
const CANVAS_API = 'api/v1/';
const API_ERROR = 'API Request Error: ';
const USERS = 'users/';
const ACCOUNTS = 'accounts/';
const COURSES = 'courses/';
const ENROLLMENTS = 'enrollments/';
const ASSIGNMENTS = 'assignments/';
const SUBMISSIONS = 'submissions/';
const STUDENTS = 'students/';
const ACTIVITY_STREAM = 'activity_stream/';
const SELF_ACCT = 'self/';
const PROGRESS = 'progress/';
const SECTIONS = 'sections/';
const GRADEABLE_STUDENTS = 'gradeable_students/';
const READ = 'read/';
const ANONYMOUS_SUBMISSIONS = 'anonymous_submissions/';
const LOGINS = 'logins/';

class CanvasServices extends ProviderServices
{
    public function __construct(int $provider_id, string $account_id, string $api_key, string $url)
    {
        $parsed_url = parse_url($url);

        if (! isset($parsed_url['scheme'])) {
            $parsed_url = parse_url($url);
            $url = 'https://'.$url;
        }

        if (! isset($parsed_url['path']) || $parsed_url['path'] !== CANVAS_API) {
            $url = self::fmtUrl($url).CANVAS_API;
        }

        parent::__construct($provider_id, (int) $account_id, $api_key, $url);
        $this->client = new Client(['headers' => ['Authorization' => 'Bearer '.$api_key]]);
    }

    public static function byProviderId(int $providerId): self
    {
        $provider = ProviderPlatform::findOrFail($providerId);

        return new CanvasServices($provider->id, $provider->account_id, $provider->access_key, $provider->base_url);
    }

    /**
     * Get a list of all Authentication providers in Canvas
     * GET /api/v1/accounts/:account_id/authentication_providers
     *
     * @return mixed JSON decoded
     */
    public function listAuthenticationProviders(): mixed
    {
        $base_url = $this->base_url.ACCOUNTS.self::fmtUrl($this->account_id).'authentication_providers';

        return $this->GET($base_url);
    }

    /**
     * This takes a canvas user id (EXTERNAL)
     * and returns the users profile from canvas
     * GET /api/v1/users/:id
     *
     * @return mixed JSON decoded
     */
    public function getUserProfile(int $user_id)
    {
        $base_url = $this->base_url.USERS.self::fmtUrl($user_id);

        return $this->GET($base_url);
    }

    /**
     * Delete the authentication provider associated with the instance in Canvas
     * GET /api/v1/accounts/:account_id/authentication_providers/:id
     *
     * @return mixed JSON decoded
     */
    public function deleteAuthProvider(): mixed
    {
        $authProviderId = ProviderPlatform::where('id', $this->provider_id)->firstOrFail()->external_auth_provider_id;
        $base_url = $this->base_url.ACCOUNTS.self::fmtUrl($this->account_id).'authentication_providers/'.$authProviderId;

        return $this->DELETE($base_url);
    }

    /**
     * Create a new login to a given provider for a given User.
     *
     *
     * @return mixed JSON decoded
     */
    public function createUserLogin(int $user_id)
    {
        $user = User::findOrFail($user_id);
        $prov_user_id = $user->externalIdFor($this->provider_id);
        try {
            $body = [
                'user[id]' => $prov_user_id,
                'login[unique_id]' => $user->email,
                'login[authentication_provider_id]' => 'openid_connect',
            ];
            $response = $this->POST($this->base_url.ACCOUNTS.self::fmtUrl($this->account_id).'logins', $body);

            return response()->json(['message' => 'Login created successfully in Canvas', 'data' => $response], 200);
        } catch (\Exception $e) {

            return response()->json(['error' => 'Failed to create login in Canvas', 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Create an identity provider in canvas for UnlockEd
     * POST /api/v1/accounts/:account_id/authentication_providers
     **/
    public function createAndRegisterAuthProvider(string $unlocked_url): mixed
    {
        // Remove the api/v1/ from the base_url
        $canvasUrl = substr($this->base_url, 0, -strlen(CANVAS_API)).'login/oauth2/callback';
        // instantiate a new client directly in passport
        $clientRepo = App::make('\Laravel\Passport\ClientRepository');

        $client = $clientRepo->create(null, 'canvas', $canvasUrl, false, false);

        if (! $unlocked_url) {
            $unlocked_url = env('APP_URL');
        }
        $unlocked_url = self::fmtUrl($unlocked_url);
        $body = [
            'auth_type' => 'openid_connect',
            'position' => 1,
            'client_id' => $client->id,
            'client_secret' => $client->plainSecret,
            'authorize_url' => $unlocked_url.'oauth/authorize',
            'token_url' => $unlocked_url.'oauth/token',
            'login_attribute' => 'email',
        ];
        $canvasUrl = $this->base_url.ACCOUNTS.self::fmtUrl($this->account_id).'authentication_providers';
        $response = $this->POST($canvasUrl, $body);

        return response()->json(['message' => 'Authentication Provider created successfully in Canvas', 'data' => $response], 200);
    }

    /**
     * Get a list of users from Canvas
     *
     * @return mixed JSON decoded
     *               AccountId can be accessed via the field in the class,
     *               but it seems most of the time it will be self.
     */
    public function listUsers(): mixed
    {
        $base_url = $this->base_url.ACCOUNTS.self::fmtUrl($this->account_id).'users?enrollment_type=student';

        return $this->GET($base_url);
    }

    /* Get details for a specific user in Canvas
     *
     * @param $user_id
     * @return mixed
     * @throws \Exception
     */
    public function showUserDetails(int $user_id): mixed
    {
        $prov_user_id = User::findOrFail($user_id)->externalIdFor($this->provider_id);
        $base_url = $this->base_url.USERS.$prov_user_id;

        return $this->GET($base_url);
    }

    /**
     * Create a new user in Canvas
     * POST /api/v1/accounts/:account_id/users
     */
    public function createStudent(string $name, string $email): mixed
    {
        $userData = [
            'user' => [
                'name' => $name,
                'skip_registration' => true,
                'terms_of_use' => true,
            ],
            'pseudonym' => [
                'unique_id' => $email,
                'send_confirmation' => false,
            ],
            'force_validations' => true,
        ];
        $base_url = $this->base_url.ACCOUNTS.SELF_ACCT.USERS;

        return $this->POST($base_url, $userData);
    }

    /**
     * List Activity Stream
     */
    public function listActivityStream(): mixed
    {
        $base_url = $this->base_url.USERS.SELF_ACCT.ACTIVITY_STREAM;

        return $this->GET($base_url);
    }

    /**
     * List Activity Stream Summary from Canvas
     */
    public function listActivityStreamSummary(): mixed
    {
        $base_url = $this->base_url.USERS.SELF_ACCT.ACTIVITY_STREAM.'summary';

        return $this->GET($base_url);
    }

    /**
     * List Todo Items from Canvas
     */
    public function listTodoItems(): mixed
    {
        $base_url = $this->base_url.USERS.self::fmtUrl($this->account_id).'todo';

        return $this->GET($base_url);
    }

    /**
     * Get Todo Items Count from Canvas
     **/
    public function getTodoItemsCount(): mixed
    {
        $base_url = $this->base_url.USERS.self::fmtUrl($this->account_id).'todo_item_count';

        return $this->GET($base_url);
    }

    /**
     * List Upcoming Assignments from Canvas
     *
     * @throws \Exception
     */
    public function listUpcomingAssignments(int $user_id): mixed
    {
        $prov_user_id = User::findOrFail($user_id)->externalIdFor($this->provider_id);
        $base_url = $this->base_url.USERS.self::fmtUrl($prov_user_id).'upcoming_events';

        return $this->GET($base_url);
    }

    /**
     * List Missing Submissions from Canvas
     */
    public function listMissingSubmissions(int $user_id): mixed
    {
        $prov_user_id = User::findOrFail($user_id)->externalIdFor($this->provider_id);
        $base_url = $this->base_url.USERS.self::fmtUrl($prov_user_id).'missing_submissions';

        return $this->GET($base_url);
    }

    /**
     * List Courses from Canvas
     **/
    public function listCourses(): mixed
    {
        $base_url = $this->base_url.ACCOUNTS.self::fmtUrl($this->account_id).'courses?include[]=course_image&include[]=public_description';

        return $this->GET($base_url);
    }

    /**
     * List Courses from Canvas per User
     * This returns the full User object complete with an array of course items
     * that the user should be enrolled in.
     *
     **/
    public function listCoursesForUser(int $user_id): mixed
    {
        $prov_user_id = User::findOrFail($user_id)->externalIdFor($this->provider_id);
        $base_url = $this->base_url.USERS.self::fmtUrl($prov_user_id).'courses?include[]=course_image&include[]=public_description';

        return $this->GET($base_url);
    }

    /**
     * List Course Assignments from Canvas
     *
     * */
    public function listUserCourseProgress(int $user_id, int $course_id): mixed
    {
        $prov_user_id = User::findOrFail($user_id)->externalIdFor($this->provider_id);
        $prov_course_id = Course::findOrFail($course_id)->external_resource_id;
        $base_url = $this->base_url.COURSES.self::fmtUrl($prov_course_id).USERS.self::fmtUrl($prov_user_id).PROGRESS;

        return $this->GET($base_url);
    }

    /**
     * Get information about an enrollment by it's ID in canvas
     */
    public function getEnrollmentById(int $enrollment_id): mixed
    {
        $base_url = $this->base_url.ACCOUNTS.self::fmtUrl($this->account_id).ENROLLMENTS.$enrollment_id;

        return $this->GET($base_url);
    }

    /**
     * List Enrollments from Canvas by User ID
     *
     * @return mixed JSON decoded
     *
     * @throws \Exception
     * */
    public function listEnrollmentsForUser(int $user_id): mixed
    {
        $prov_user_id = User::findOrFail($user_id)->externalIdFor($this->provider_id);
        $course_id = $this->listCoursesForUser($user_id);
        $enrollments = [];
        foreach ($course_id as $course) {
            $base_url = $this->base_url.COURSES.self::fmtUrl($course['id'])."enrollments?user_id=$prov_user_id";
            $response = $this->GET($base_url);
            $enrollments[] = $response;
        }

        return $enrollments;
    }

    /**
     * List Enrollments from Canvas by Course ID
     *
     * @throws \Exception
     **/
    public function listEnrollmentsByCourse(int $course_id): mixed
    {
        $course = \App\Models\Course::findOrFail($course_id);
        $prov_course_id = $course->external_resource_id;
        $base_url = $this->base_url.COURSES.self::fmtUrl($prov_course_id).ENROLLMENTS;

        return $this->GET($base_url);
    }

    /**
     * List Course Enrollments By Section
     *
     * @return mixed JSON decoded
     *
     * @throws \Exception
     **/
    public function listEnrollmentsBySection(int $sectionId): mixed
    {
        $base_url = $this->base_url.SECTIONS.self::fmtUrl($sectionId).ENROLLMENTS;

        return $this->GET($base_url);
    }

    /**
     * Enroll a user in a course
     *
     **/
    public function enrollUser(int $user_id, int $course_id): mixed
    {
        $prov_user_id = User::findOrFail($user_id)->externalIdFor($this->provider_id);
        $our_id = Course::findOrFail($course_id);
        $prov_course_id = $our_id->external_resource_id;
        $enrollment = [
            'enrollment' => [
                'user_id' => $prov_user_id,
                'type' => 'StudentEnrollment',
            ],
        ];
        $base_url = $this->base_url.COURSES.self::fmtUrl($prov_course_id).ENROLLMENTS;

        return $this->POST($base_url, $enrollment);
    }

    /**
     * List Assignments for User
     **/
    public function listAssignmentsForUser(int $course_id, int $user_id): mixed
    {
        $our_id = Course::findOrFail($course_id);
        $prov_course_id = $our_id->external_resource_id;
        $prov_user_id = User::findOrFail($user_id)->externalIdFor($this->provider_id);
        $base_url = $this->base_url.USERS.self::fmtUrl($prov_user_id).COURSES.self::fmtUrl($prov_course_id).ASSIGNMENTS;

        return $this->GET($base_url);
    }

    /**
     * List Assignments for Course
     **/
    public function listAssignmentsByCourse(int $course_id): mixed
    {
        $our_id = Course::findOrFail($course_id);
        $prov_course_id = $our_id->external_resource_id;
        $base_url = $this->base_url.COURSES.self::fmtUrl($prov_course_id).ASSIGNMENTS;

        return $this->GET($base_url);
    }

    /**
     * List Assignments for Course
     *
     * @return mixed JSON decoded
     **/
    public function listAssignmentGroupsByCourse(int $assignment_group_id, int $course_id): mixed
    {
        $our_id = Course::findOrFail($course_id);
        $prov_course_id = $our_id->external_resource_id;
        $base_url = $this->base_url.COURSES.self::fmtUrl($prov_course_id).'assignment_groups/'.self::fmtUrl($assignment_group_id).ASSIGNMENTS;

        return $this->GET($base_url);
    }

    /**
     * Get a single Assignment
     * **/
    public function getAssignment(int $course_id, int $assignment_id): mixed
    {
        $our_id = Course::findOrFail($course_id);
        $prov_course_id = $our_id->external_resource_id;
        $base_url = $this->base_url.COURSES.self::fmtUrl($prov_course_id).ASSIGNMENTS.$assignment_id;

        return $this->DELETE($base_url);
    }

    /*
        * List assignment submissions for a given Course ID
        * @param string $course_id
        * @param string $assignment_id
        * @return mixed
        **/
    public function listAssignmentSubmissions(int $course_id, int $assignment_id): mixed
    {
        $our_id = Course::findOrFail($course_id);
        $prov_course_id = $our_id->external_resource_id;
        $base_url = $this->base_url.COURSES.self::fmtUrl($prov_course_id).ASSIGNMENTS.self::fmtUrl($assignment_id).SUBMISSIONS;

        return $this->GET($base_url);
    }

    /*
        * List submissions for multiple assignments for a given Course ID
        * @param string $course_id
        * @return mixed
        **/
    public function listSubmissionsForMultipleAssignments(int $course_id): mixed
    {
        $our_id = Course::findOrFail($course_id);
        $prov_course_id = $our_id->external_resource_id;
        $base_url = $this->base_url.COURSES.self::fmtUrl($prov_course_id).STUDENTS.SUBMISSIONS;

        return $this->GET($base_url);
    }

    /*
        * Get single submission for user / assignment
        * @param string $course_id
        * @param string $user_id
        * @param string $assignment_id
        * @return mixed
        **/
    public function listSubmissionsForUser(int $course_id, int $assignment_id, int $user_id): mixed
    {
        $our_id = Course::findOrFail($course_id);
        $prov_course_id = $our_id->external_resource_id;
        $prov_user_id = User::findOrFail($user_id)->externalIdFor($this->provider_id);
        $base_url = $this->base_url.COURSES.self::fmtUrl($prov_course_id).ASSIGNMENTS.self::fmtUrl($assignment_id).SUBMISSIONS.$prov_user_id;

        return $this->GET($base_url);
    }

    /*
        * Get Submision summary
        * @param $course_id
        * @param $assignment_id
        * @return mixed
        **/
    public function listSubmissionSummary(int $course_id, int $assignment_id): mixed
    {
        $prov_course_id = Course::findOrFail($course_id)->external_resource_id;
        $base_url = $this->base_url.COURSES.self::fmtUrl($prov_course_id).ASSIGNMENTS.self::fmtUrl($assignment_id).'submission_summary';

        return $this->GET($base_url);
    }
}
