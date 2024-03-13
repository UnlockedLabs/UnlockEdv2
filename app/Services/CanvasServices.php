<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Course;
use App\Models\Enrollment;
use App\Models\ProviderPlatform;
use App\Models\User;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Illuminate\Support\Facades\App;
use Psr\Http\Message\ResponseInterface;

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

class CanvasServices
{
    private int $provider_id;

    private int $account_id;

    private string $access_key;

    private string $base_url;

    private Client $client;

    /**
     * Adds a trailing slash if none exists.
     *
     * @return string Formatted account or user ID
     *
     * @throws \InvalidArgumentException If the account ID is invalid
     */
    private static function fmtUrl($id): string
    {
        if (! is_string($id)) {
            $id = strval($id);
        }
        if (substr($id, -1) !== '/') {
            $id .= '/';
        }

        return $id;
    }

    public function __construct(int $providerId, int $accountId, string $apiKey, string $url)
    {
        $parsedUrl = parse_url($url);
        if (! isset($parsedUrl['scheme'])) {
            $url = 'https://'.$url;
        }

        if (! isset($parsedUrl['path']) || $parsedUrl['path'] !== CANVAS_API) {
            $url = self::fmtUrl($url).CANVAS_API;
        }

        if ($accountId === 0 || $accountId === null) {
            $accountId = SELF_ACCT;
        }

        $this->provider_id = $providerId;
        $this->account_id = $accountId;
        $this->access_key = $apiKey;
        $this->base_url = $url;
        $this->client = new Client();
    }

    public function getAccountId(): int
    {
        return $this->account_id;
    }

    public function getAccessKey(): string
    {
        return $this->access_key;
    }

    public function getBaseUrl(): string
    {
        return $this->base_url;
    }

    private function GET(string $url): mixed
    {
        try {
            $response = $this->client->request(
                'GET',
                $url,
                ['headers' => ['Authorization' => "Bearer $this->access_key"]]
            );
        } catch (RequestException $e) {
            throw new \Exception('API_ERROR '.$e->getMessage());
        }

        return self::handleResponse($response);
    }

    private function POST(string $url, array $body): mixed
    {
        try {
            $response = $this->client->request(
                'POST',
                $url,
                ['headers' => ['Authorization' => "Bearer $this->access_key"], 'form_params' => $body]
            );
        } catch (RequestException $e) {
            throw new \Exception('API_ERROR '.$e->getMessage());
        }

        return self::handleResponse($response);
    }

    private function PUT(string $url, array $body): mixed
    {
        try {
            $response = $this->client->request(
                'PUT',
                $url,
                ['headers' => ['Authorization' => "Bearer $this->access_key"], 'form_params' => $body]
            );
        } catch (RequestException $e) {
            throw new \Exception('API_ERROR '.$e->getMessage());
        }

        return self::handleResponse($response);
    }

    private function DELETE(string $url): mixed
    {
        try {
            $response = $this->client->request('DELETE', $url, ['headers' => ['Authorization' => "Bearer $this->access_key"]]);
        } catch (RequestException $e) {
            throw new \Exception('API_ERROR '.$e->getMessage());
        }

        return self::handleResponse($response);
    }

    // Returns an instance of CanvasServices to make dynamic API calls.
    /*****************************************************
    //* @param int $providerId
    //* @return  CanvasServices
    //* @throws \InvalidArgumentException
     */
    public static function byProviderId(int $providerId): CanvasServices
    {
        $provider = ProviderPlatform::where(['id' => $providerId])->firstOrFail();

        return new self($providerId, (int) $provider->account_id, $provider->access_key, $provider->base_url);
    }

    private static function handleResponse(ResponseInterface $response): mixed
    {
        if ($response->getStatusCode() === 200 || $response->getStatusCode() === 201 || $response->getStatusCode() === 204) {
            return json_decode($response->getBody()->getContents(), true);
        } else {
            throw new \Exception('API request failed with status code: '.$response->getStatusCode());
        }
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
     * Delete the authentication provider associated with the instance in Canvas
     * GET /api/v1/accounts/:account_id/authentication_providers/:id
     *
     * @return mixed JSON decoded
     */
    public function deleteAuthProvider(): mixed
    {
        $authProviderId = ProviderPlatform::where('id', $this->provider_id)->firstOrFail()->authentication_provider_id;
        $base_url = $this->base_url.ACCOUNTS.self::fmtUrl($this->account_id).'authentication_providers/'.$authProviderId;

        return $this->DELETE($base_url);
    }

    /**
     * Create a new login to a given provider for a given User.
     *
     *
     * @return mixed JSON decoded
     */
    public function createUserLogin(int $userId)
    {
        $user = User::findOrFail($userId);
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
     *
     * @param   client_id [Required]:  The Client ID for Canvas to use
     * @param client_secret [Required]: The Client Secret for Canvas to use
     * @param unlocked_url [Optional]: The URL for UnlockEd to use (default = APP_URL in .env)
     * @return mixed JSON decoded
     */
    public function createAndRegisterAuthProvider(?string $unlockedUrl): mixed
    {
        // Remove the api/v1/ from the base_url
        $canvasUrl = substr($this->base_url, 0, -strlen(CANVAS_API)).'login/oauth2/callback';
        // instantiate a new client directly in passport
        $clientRepo = App::make('\Laravel\Passport\ClientRepository');

        $client = $clientRepo->create(null, 'canvas', $canvasUrl, false, false);

        if (! $unlockedUrl) {
            $unlockedUrl = env('APP_URL');
        }
        $unlockedUrl = self::fmtUrl($unlockedUrl);
        $body = [
            'auth_type' => 'openid_connect',
            'position' => 1,
            'client_id' => $client->id,
            'client_secret' => $client->plainSecret,
            'authorize_url' => $unlockedUrl.'oauth/authorize',
            'token_url' => $unlockedUrl.'oauth/token',
            'login_attribute' => 'email',
        ];
        $canvasUrl = $this->base_url.ACCOUNTS.self::fmtUrl($this->account_id).'authentication_providers';
        $response = $this->POST($canvasUrl, $body);

        return response()->json(['message' => 'Authentication Provider created successfully in Canvas', 'data' => $response], 200);
    }

    /**
     * Get a list of users from Canvas
     *
     * @param? string
     *
     * @return mixed JSON decoded
     *
     * @throws \Exception
     *
     * AccountId can be accessed via the field in the class,
     * but it seems most of the time it will be self.
     */
    public function listUsers(): mixed
    {
        $base_url = $this->base_url.ACCOUNTS.self::fmtUrl($this->account_id).USERS;

        return $this->GET($base_url);
    }

    /* Get details for a specific user in Canvas
     *
     * @param string $userId
     * @return mixed JSON decoded
     * @throws \Exception
     */
    public function showUserDetails(int $userId): mixed
    {
        $prov_user_id = User::findOrFail($userId)->externalIdFor($this->provider_id);
        $base_url = $this->base_url.USERS.$prov_user_id;

        return $this->GET($base_url);
    }

    /**
     * Create a new user in Canvas
     *
     * @param? boolean $terms (defaults true)
     *
     * @return mixed (decoded json)
     *
     * @throws \Exception
     */
    public function createStudent(string $name, string $email, bool $terms = true): mixed
    {
        $userData = [
            'user' => [
                'name' => $name,
                'skip_registration' => true,
                'terms_of_use' => $terms,
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
     *
     * @param? string $account (default self)
     *
     * @return mixed (decoded json)
     *
     * @throws \Exception
     */
    public function listActivityStream(): mixed
    {
        $base_url = $this->base_url.USERS.SELF_ACCT.ACTIVITY_STREAM;

        return $this->GET($base_url);
    }

    /**
     * List Activity Stream Summary from Canvas
     *
     * @param? string $account (default self)
     *
     * @return mixed (decoded json)
     *
     * @throws \Exception
     */
    public function listActivityStreamSummary(): mixed
    {
        $base_url = $this->base_url.USERS.SELF_ACCT.ACTIVITY_STREAM.'summary';

        return $this->GET($base_url);
    }

    /**
     * List Todo Items from Canvas
     *
     * @param? string $account (default self)
     *
     * @return mixed (decoded json)
     *
     * @throws \Exception
     */
    public function listTodoItems(): mixed
    {
        $base_url = $this->base_url.USERS.self::fmtUrl($this->account_id).'todo';

        return $this->GET($base_url);
    }

    /**
     * Get Todo Items Count from Canvas
     *
     * @param? string $account (default self)
     *
     * @return mixed (decoded json)
     *
     **/
    public function getTodoItemsCount(): mixed
    {
        $base_url = $this->base_url.USERS.self::fmtUrl($this->account_id).'todo_item_count';

        return $this->GET($base_url);
    }

    /**
     * List Upcoming Assignments from Canvas
     *
     * @param? string $account (default self)
     *
     * @return mixed (decoded json)
     *
     * @throws \Exception
     */
    public function listUpcomingAssignments(int $userId): mixed
    {
        $prov_user_id = User::findOrFail($userId)->externalIdFor($this->provider_id);
        $base_url = $this->base_url.USERS.self::fmtUrl($prov_user_id).'upcoming_events';

        return $this->GET($base_url);
    }

    /**
     * List Missing Submissions from Canvas
     *
     * @param? string $userId (default self)
     *
     * @return mixed JSON decoded
     *
     * @throws \Exception
     */
    public function listMissingSubmissions(int $userId): mixed
    {
        $prov_user_id = User::findOrFail($userId)->externalIdFor($this->provider_id);
        $base_url = $this->base_url.USERS.self::fmtUrl($prov_user_id).'missing_submissions';

        return $this->GET($base_url);
    }

    /**
     * List Courses from Canvas
     *
     * @return mixed JSON decoded
     *
     * @throws \Exception
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
     * @param  string  $user
     * @return mixed JSON decoded
     *
     * @throws \Exception
     **/
    public function listCoursesForUser(int $userId): mixed
    {
        $prov_user_id = User::findOrFail($userId)->externalIdFor($this->provider_id);
        $base_url = $this->base_url.USERS.self::fmtUrl($prov_user_id).'courses?include[]=course_image&include[]=public_description';

        return $this->GET($base_url);
    }

    /**
     * List Course Assignments from Canvas
     *
     * @param  string  $userId  (default self)
     * @return mixed JSON decoded
     *
     * @throws \Exception
     *
     * Canvas Docs:
     * "You can supply self as the user_id to query your own progress
     * in a course. To query another user’s progress, you must be a
     * teacher in the course, an administrator, or a linked observer of the user."
     * */
    public function listUserCourseProgress(int $userId, int $courseId): mixed
    {
        $prov_user_id = User::findOrFail($userId)->externalIdFor($this->provider_id);
        $prov_course_id = Course::findOrFail($courseId)->provider_resource_id;
        $base_url = $this->base_url.COURSES.self::fmtUrl($prov_course_id).USERS.self::fmtUrl($prov_user_id).PROGRESS;

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
     * @param string $
     * @return mixed JSON decoded
     *
     * @throws \Exception
     **/
    public function listEnrollmentsByCourse(int $courseId): mixed
    {
        $our_id = Course::findOrFail($courseId);
        $prov_course_id = $our_id->provider_resource_id;
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
     * @param  string  $user_id
     * @param  string  $course_id
     *
     * @param? string $type (default=StudentEnrollment)
     *
     * @return mixed JSON decoded
     *
     * @throws \Exception
     **/
    public function enrollUser(int $userId, int $courseId): mixed
    {
        $prov_user_id = User::findOrFail($userId)->externalIdFor($this->provider_id);
        $our_id = Course::findOrFail($courseId);
        $prov_course_id = $our_id->provider_resource_id;
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
     *  Enroll a user in a Section
     *
     * @param  string  $user_id  (default=self)
     *
     * @param? string $type (default=StudentEnrollment)
     *
     * @return mixed decoded JSON
     *
     * @throws Exception
     **/
    public function enrollUserInSection(string $sectionId, int $userId, string $type = 'StudentEnrollment'): mixed
    {
        $prov_user_id = User::findOrFail($userId)->externalIdFor($this->provider_id);
        $enrollment = [
            'enrollment' => [
                'user_id' => $prov_user_id,
                'type' => $type,
            ],
        ];
        $base_url = $this->base_url.SECTIONS.self::fmtUrl($sectionId).ENROLLMENTS.$enrollment;

        return $this->POST($base_url, $enrollment);
    }

    /**
     *  Delete a course Enrollment
     *
     * @param  string  $course_id
     * @param  string  $user_id  (default=self)
     * @return mixed JSON decoded
     *
     * @throws Exception
     */
    public function deleteEnrollment(int $enrollmentId, int $courseId): mixed
    {
        $our_id = Course::findOrFail($courseId);
        $prov_course_id = $our_id->provider_resource_id;
        $our_id = Enrollment::findOrFail($enrollmentId);
        $prov_enrollment_id = $our_id->provider_enrollment_id;
        $base_url = $this->base_url.COURSES.self::fmtUrl($prov_course_id).ENROLLMENTS.$prov_enrollment_id;

        return $this->DELETE($base_url);
    }

    /**
     * Accept a course invitation
     *
     * @param  string  $course_id
     * @param  string  $user_id  (default=self)
     * @return mixed JSON decoded
     *
     * @throws Exception
     */
    public function acceptCourseInvitation(int $courseId, int $userId): mixed
    {
        $our_id = Course::findOrFail($courseId);
        $prov_course_id = $our_id->provider_resource_id;
        $prov_user_id = User::findOrFail($userId)->externalIdFor($this->provider_id);
        $base_url = $this->base_url.COURSES.self::fmtUrl($prov_course_id).ENROLLMENTS.self::fmtUrl($prov_user_id).'accept';

        return $this->POST($base_url, []);
    }

    /**
     * Reject a course invitation
     *
     * @param  string  $userId  (default=self)
     * @return mixed decoded JSON
     *
     * @throws Exception
     */
    public function rejectCourseInvitation(int $courseId, int $userId): mixed
    {
        $our_id = Course::findOrFail($courseId);
        $prov_course_id = $our_id->provider_resource_id;
        $prov_user_id = User::findOrFail($userId)->externalIdFor($this->provider_id);
        $base_url = $this->base_url.COURSES.self::fmtUrl($prov_course_id).ENROLLMENTS.self::fmtUrl($prov_user_id).'reject';

        return $this->POST($base_url, []);
    }

    /**
     * Reactivate a course enrollment
     *
     * @param  string  $userId  (default=self)
     * @return mixed decoded JSON
     *
     * @throws Exception
     **/
    public function reactivateCourseEnrollment(int $courseId, int $userId): mixed
    {
        $our_id = Course::findOrFail($courseId);
        $prov_course_id = $our_id->provider_resource_id;
        $prov_user_id = User::findOrFail($userId)->externalIdFor($this->provider_id);
        $base_url = $this->base_url.COURSES.self::fmtUrl($prov_course_id).ENROLLMENTS.self::fmtUrl($prov_user_id).'reactivate';

        return $this->PUT($base_url, []);
    }

    /**
     * Add last attended date of course
     *
     * @param  string  $userId  (default=self)
     * @return mixed decoded JSON
     *
     * @throws Exception
     **/
    public function addLastAttendedDate(string $courseId, string $userId = 'self'): mixed
    {
        $prov_user_id = User::findOrFail($userId)->externalIdFor($this->provider_id);
        $base_url = $this->base_url.COURSES.self::fmtUrl($courseId).ENROLLMENTS.self::fmtUrl($prov_user_id).'last_attended';

        return $this->PUT($base_url, []);
    }

    /**
     * List Assignments for User
     *
     * @param  string  $userId  (default=self)
     * @param  string  $coursrId
     * @return mixed JSON decoded
     *
     * @throws Exception
     **/
    public function listAssignmentsForUser(int $courseId, int $userId): mixed
    {
        $our_id = Course::findOrFail($courseId);
        $prov_course_id = $our_id->provider_resource_id;
        $prov_user_id = User::findOrFail($userId)->externalIdFor($this->provider_id);
        $base_url = $this->base_url.USERS.self::fmtUrl($prov_user_id).COURSES.self::fmtUrl($prov_course_id).ASSIGNMENTS;

        return $this->GET($base_url);
    }

    /**
     * List Assignments for Course
     *
     * @return mixed JSON decoded
     *
     * @throws Exception
     **/
    public function listAssignmentsByCourse(int $courseId): mixed
    {
        $our_id = Course::findOrFail($courseId);
        $prov_course_id = $our_id->provider_resource_id;
        $base_url = $this->base_url.COURSES.self::fmtUrl($prov_course_id).ASSIGNMENTS;

        return $this->GET($base_url);
    }

    /**
     * List Assignments for Course
     *
     * @return mixed JSON decoded
     *
     * @throws Exception
     **/
    public function listAssignmentGroupsByCourse(int $assignmentGroupId, int $courseId): mixed
    {
        $our_id = Course::findOrFail($courseId);
        $prov_course_id = $our_id->provider_resource_id;
        $base_url = $this->base_url.COURSES.self::fmtUrl($prov_course_id).'assignment_groups/'.self::fmtUrl($assignmentGroupId).ASSIGNMENTS;

        return $this->GET($base_url);
    }

    /**
     * Delete Assignment
     *
     * @return mixed JSON decoded
     *
     * @throws Exception
     **/
    public function deleteAssignment(string $courseId, string $assignmentId): mixed
    {
        $base_url = $this->base_url.COURSES.self::fmtUrl($courseId).ASSIGNMENTS.$assignmentId;

        return $this->DELETE($base_url);
    }

    /**
     * Get a single Assignment
     *
     * @return mixed JSON decoded
     *
     * @throws Exception
     **/
    public function getAssignment(int $courseId, int $assignmentId): mixed
    {
        $our_id = Course::findOrFail($courseId);
        $prov_course_id = $our_id->provider_resource_id;
        $base_url = $this->base_url.COURSES.self::fmtUrl($prov_course_id).ASSIGNMENTS.$assignmentId;

        return $this->DELETE($base_url);
    }

    /*
        * Create an assignment for a given Course ID
        *
        * There are so many possible parameters, but the only one required
        * is "name" so we will just pass in the array which can have any
        * or all of them
        * @param associative array $assignmentInfo
        * @param string $courseId
        * @return mixed JSON decoded
        * @throws Exception
        **/
    public function createAssignmentForCourse(array $assignmentInfo, string $courseId): mixed
    {
        $our_id = Course::findOrFail($courseId);
        $prov_course_id = $our_id->provider_resource_id;
        $base_url = $this->base_url.COURSES.self::fmtUrl($prov_course_id).ASSIGNMENTS.$assignmentInfo;

        return $this->POST($base_url, $assignmentInfo);
    }

    /*
        * Edit an assignment for a given Course ID
        *
        * There are so many possible parameters, but the only one required
        * is "name" so we will just pass in the array which can have any
        * or all of them
        * @param associative array $assignmentInfo
        * @param string $courseId
        * @param string $assignmentId
        * @return mixed decoded JSON
        * @throws Exception
        **/
    public function editAssignmentForCourse(array $assignmentInfo, int $courseId, int $assignmentId): mixed
    {
        $our_id = Course::findOrFail($courseId);
        $prov_course_id = $our_id->provider_resource_id;
        $base_url = $this->base_url.COURSES.self::fmtUrl($prov_course_id).ASSIGNMENTS.self::fmtUrl($assignmentId).$assignmentInfo;

        return $this->PUT($base_url, $assignmentInfo);
    }

    /*
        * Edit an assignment for a given Course ID
        *
        * There are so many possible parameters, but the only one required
        * is "name" so we will just pass in the array which can have any
        * or all of them
        * @param associative array $assignment (could also be a file? TODO: look into submissions)
        * @param string $courseId
        * @param string $assignmentId
        * @return mixed decoded JSON
        * @throws Exception
        **/
    public function submitAssignment(int $courseId, int $assignmentId, array $assignment): mixed
    {

        $base_url = $this->base_url.COURSES.self::fmtUrl($courseId).ASSIGNMENTS.self::fmtUrl($assignmentId).SUBMISSIONS.$assignment;

        return $this->POST($base_url, $assignment);
    }

    /*
        * List assignment submissions for a given Course ID
        *
        * @param string $courseId
        * @param string $assignmentId
        * @return mixed decoded JSON
        * @throws Exception
        **/
    public function listAssignmentSubmissions(int $courseId, int $assignmentId): mixed
    {
        $our_id = Course::findOrFail($courseId);
        $prov_course_id = $our_id->provider_resource_id;
        $base_url = $this->base_url.COURSES.self::fmtUrl($prov_course_id).ASSIGNMENTS.self::fmtUrl($assignmentId).SUBMISSIONS;

        return $this->GET($base_url);
    }

    /*
        * List submissions for multiple assignments for a given Course ID
        *
        * @param string $courseId
        * @param string $assignmentId
        * @return mixed decoded JSON
        * @throws Exception
        **/
    public function listSubmissionsForMultipleAssignments(int $courseId): mixed
    {
        $our_id = Course::findOrFail($courseId);
        $prov_course_id = $our_id->provider_resource_id;
        $base_url = $this->base_url.COURSES.self::fmtUrl($prov_course_id).STUDENTS.SUBMISSIONS;

        return $this->GET($base_url);
    }

    /*
        * Get single submission for user / assignment
        *
        * @param string $courseId
        * @param string $userId
        * @param string $assignmentId
        * @return mixed decoded JSON
        * @throws Exception
        **/
    public function listSubmissionsForUser(int $courseId, int $assignmentId, int $userId): mixed
    {
        $our_id = Course::findOrFail($courseId);
        $prov_course_id = $our_id->provider_resource_id;
        $prov_user_id = User::findOrFail($userId)->externalIdFor($this->provider_id);
        $base_url = $this->base_url.COURSES.self::fmtUrl($prov_course_id).ASSIGNMENTS.self::fmtUrl($assignmentId).SUBMISSIONS.$prov_user_id;

        return $this->GET($base_url);
    }

    /*
        * Get single submission by anonymous ID
        *
        * @param string $courseId
        * @param string $anonId
        * @param string $assignmentId
        * @return mixed decoded JSON
        * @throws Exception
        **/
    public function listSubmissionForAnonID(string $courseId, string $assignmentId, string $anonId): mixed
    {
        $base_url = $this->base_url.COURSES.self::fmtUrl($courseId).ASSIGNMENTS.self::fmtUrl($assignmentId).ANONYMOUS_SUBMISSIONS.$anonId;

        return $this->GET($base_url);
    }

    /*
        * Upload a file for submission
        *
        * @param string $courseId
        * @param string $userId
        * @param string $assignmentId
        * @return mixed decoded JSON
        * @throws Exception
        **/
    public function uploadFileForSubmission(int $courseId, int $assignmentId, int $userId): mixed
    {
        $prov_user_id = User::findOrFail($userId)->externalIdFor($this->provider_id);
        $prov_course_id = Course::findOrFail($courseId)->provider_resource_id;
        $base_url = $this->base_url.COURSES.self::fmtUrl($prov_course_id).ASSIGNMENTS.self::fmtUrl($assignmentId).SUBMISSIONS.self::fmtUrl($prov_user_id).'files';

        return $this->POST($base_url, []);
    }

    /*
        * Get Submision summary
        *
        * @param string $courseId
        * @param string $assignmentId
        * @return mixed decoded JSON
        * @throws Exception
        **/
    public function listSubmissionSummary(string $courseId, string $assignmentId): mixed
    {
        $prov_course_id = Course::findOrFail($courseId)->provider_resource_id;
        $base_url = $this->base_url.COURSES.self::fmtUrl($prov_course_id).ASSIGNMENTS.self::fmtUrl($assignmentId).'submission_summary';

        return $this->GET($base_url);
    }
}
