<?php

declare(strict_types=1);

use App\Models\ProviderPlatform;
use App\Models\User;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
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

    public Client $client;

    /**
     * Adds a trailing slash if none exists.
     *
     * @return string Formatted account or user ID
     *
     * @throws \InvalidArgumentException If the account ID is invalid
     */
    public static function fmtUrl(string $id): string
    {
        if (substr($id, -1) !== '/') {
            $id .= '/';
        }

        return $id;
    }

    // Constructor, if the URL is missing the protocol or api version , add it.
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

    private function getAuthHeaders(): array
    {
        return ['headers' => ['Authorization' => "Bearer $this->access_key"]];
    }

    private function getAuthHeadersBody(array $body): array
    {
        return ['headers' => ['Authorization' => "Bearer $this->access_key"], 'body' => $body];
    }

    private function GET(string $url): mixed
    {
        try {
            $response = $this->client->get($url, ['headers' => $this->getAuthHeaders()]);
        } catch (RequestException $e) {
            throw new \Exception('API_ERROR '.$e->getMessage());
        }

        return self::handleResponse($response);
    }

    private function POST(string $url, array $body): mixed
    {
        try {
            $response = $this->client->post($url, $this->getAuthHeadersBody($body));
        } catch (RequestException $e) {
            throw new \Exception('API_ERROR '.$e->getMessage());
        }

        return self::handleResponse($response);
    }

    private function PUT(string $url, array $body): mixed
    {
        try {
            $response = $this->client->put($url, $this->getAuthHeadersBody($body));
        } catch (RequestException $e) {
            throw new \Exception('API_ERROR '.$e->getMessage());
        }

        return self::handleResponse($response);
    }

    private function DELETE(string $url): mixed
    {
        try {
            $response = $this->client->delete($url, $this->getAuthHeaders());
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
    public static function byProviderId(int $providerId): CanvasServices|InvalidArgumentException
    {
        $provider = ProviderPlatform::findOrfFail($providerId);
        if (! $provider) {
            throw new \InvalidArgumentException('Invalid provider ID');
        }

        return new self($provider->provider_id, $provider->account_id, $provider->access_key, $provider->base_url);
    }

    public static function handleResponse(ResponseInterface $response): mixed
    {
        if ($response->getStatusCode() == 200) {
            return json_decode($response->getBody()->__toString());
        } else {
            throw new \Exception('API request failed with status code: '.$response->getStatusCode());
        }
    }

    /**
     * Create a new login to a given provider for a given User.
     *
     *
     * @return mixed JSON decoded
     */
    public static function createUserLogin(int $userId, int $providerId, string $authProviderId = 'openid_connect')
    {
        $canvasService = self::byProviderId($providerId);
        $user = User::findOrFail($userId);
        $accountId = $canvasService['account_id'];
        $canvasUrl = $canvasService->base_url;
        $token = $canvasService['access_key'];
        try {
            $response = $canvasService->POST($canvasUrl.ACCOUNTS.$accountId.'/logins', [
                'form_params' => [
                    'user[id]' => $user->id,
                    'login[unique_id]' => $user->email,
                    'login[password]' => $user->password,
                    'login[authentication_provider_id]' => $authProviderId,
                ],
                'headers' => [
                    'Authorization' => "Bearer $token",
                ],
            ]);

            return response()->json(['message' => 'Login created successfully in Canvas', 'data' => json_decode((string) $response->getBody())], 200);
        } catch (\Exception $e) {

            return response()->json(['error' => 'Failed to create login in Canvas', 'message' => $e->getMessage()], 500);
        }
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
    public function listUsers(string $accountId = 'self'): mixed
    {
        $base_url = $this->base_url.ACCOUNTS.self::fmtUrl($accountId).USERS;

        return $this->GET($base_url);
    }

    /* Get details for a specific user in Canvas
     *
     * @param string $userId
     * @return mixed JSON decoded
     * @throws \Exception
     */
    public function showUserDetails(string $userId = 'self'): mixed
    {
        $base_url = $this->base_url.USERS.$userId;

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
    public function createStudentInCanvas(string $name, string $email, bool $terms = true): mixed
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
    public function listActivityStream(string $account = 'self'): mixed
    {
        $base_url = $this->base_url.USERS.self::fmtUrl($account).ACTIVITY_STREAM;

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
    public function getActivityStreamSummary(string $account = 'self'): mixed
    {
        $base_url = $this->base_url.USERS.self::fmtUrl($account).ACTIVITY_STREAM.'summary';

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
    public function listTodoItems(string $account = 'self'): mixed
    {
        $base_url = $this->base_url.USERS.self::fmtUrl($account).'todo';

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
    public function getTodoItemsCount(string $account = 'self'): mixed
    {
        $base_url = $this->base_url.USERS.self::fmtUrl($account).'todo_item_count';

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
    public function listUpcomingAssignments(string $userId = 'self'): mixed
    {
        $base_url = $this->base_url.USERS.self::fmtUrl($userId).'upcoming_events';

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
    public function listMissingSubmissions(string $userId = 'self'): mixed
    {
        $base_url = $this->base_url.USERS.self::fmtUrl($userId).'missing_submissions';

        return $this->GET($base_url);
    }

    /**
     * List Courses from Canvas
     *
     * @return mixed JSON decoded
     *
     * @throws \Exception
     **/
    public function listCourses($accountId = 'self'): mixed
    {
        $base_url = $this->base_url.ACCOUNTS.self::fmtUrl($accountId).COURSES;

        return $this->GET($base_url);
    }

    /**
     * List Courses from Canvas per User
     * This returns the full User object complete with an array of course items
     * that the user should be enrolled in.
     *
     * @param  string  $userI
     * @return mixed JSON decoded
     *
     * @throws \Exception
     **/
    public function listCoursesForUser(string $userId = 'self'): mixed
    {
        $base_url = $this->base_url.USERS.self::fmtUrl($userId).COURSES;

        return $this->GET($base_url);
    }

    /**
     * List Course Assignments from Canvas
     *
     * @param  string  $userId (default self)
     * @return mixed JSON decoded
     *
     * @throws \Exception
     *
     * Canvas Docs:
     * "You can supply self as the user_id to query your own progress
     * in a course. To query another user’s progress, you must be a
     * teacher in the course, an administrator, or a linked observer of the user."
     * */
    public function getUserCourseProgress(string $userId, string $courseId): mixed
    {
        $base_url = $this->base_url.COURSES.self::fmtUrl($courseId).USERS.self::fmtUrl($userId).PROGRESS;

        return $this->GET($base_url);
    }

    /**
     * List Course Assignments from Canvas
     *
     * @return mixed JSON decoded
     *
     * @throws \Exception
     * */
    public function getEnrollmentsByUser(string $userId): mixed
    {
        $base_url = $this->base_url.USERS.self::fmtUrl($userId).ENROLLMENTS;

        return $this->GET($base_url);
    }

    /**
     * List Enrollments from Canvas by Course ID
     *
     * @param string $
     * @return mixed JSON decoded
     *
     * @throws \Exception
     **/
    public function getEnrollmentsByCourse(string $courseId): mixed
    {
        $base_url = $this->base_url.COURSES.self::fmtUrl($courseId).ENROLLMENTS;

        return $this->GET($base_url);
    }

    /**
     * List Course Enrollments By Section
     *
     * @return mixed JSON decoded
     *
     * @throws \Exception
     **/
    public function getEnrollmentsBySection(string $sectionId): mixed
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
    public function enrollUser(string $userId, string $type, string $courseId): mixed
    {
        $enrollment = [
            'user_id' => [$userId],
            'type' => [$type],
        ];
        $base_url = $this->base_url.COURSES.self::fmtUrl($courseId).ENROLLMENTS.$enrollment;

        return $this->POST($base_url, $enrollment);
    }

    /**
     *  Enroll a user in a Section
     *
     * @param  string  $user_id (default=self)
     *
     * @param? string $type (default=StudentEnrollment)
     *
     * @return mixed decoded JSON
     *
     * @throws Exception
     **/
    public function enrollUserInSection(string $sectionId, string $userId, string $type = 'StudentEnrollment'): mixed
    {
        $enrollment = [
            'user_id' => [$userId],
            'type' => [$type],
        ];
        $base_url = $this->base_url.SECTIONS.self::fmtUrl($sectionId).ENROLLMENTS.$enrollment;

        return $this->POST($base_url, $enrollment);
    }

    /**
     *  Delete a course Enrollment
     *
     * @param  string  $course_id
     * @param  string  $user_id (default=self)
     * @return mixed JSON decoded
     *
     * @throws Exception
     */
    public function deleteEnrollment(string $enrollmentId, string $courseId): mixed
    {
        $base_url = $this->base_url.COURSES.self::fmtUrl($courseId).ENROLLMENTS.$enrollmentId;

        return $this->DELETE($base_url);
    }

    /**
     * Accept a course invitation
     *
     * @param  string  $course_id
     * @param  string  $user_id (default=self)
     * @return mixed JSON decoded
     *
     * @throws Exception
     */
    public function acceptCourseInvitation(string $courseId, string $userId = 'self'): mixed
    {
        $base_url = $this->base_url.COURSES.self::fmtUrl($courseId).ENROLLMENTS.self::fmtUrl($userId).'accept';

        return $this->POST($base_url, []);
    }

    /**
     * Reject a course invitation
     *
     * @param  string  $userId (default=self)
     * @return mixed decoded JSON
     *
     * @throws Exception
     */
    public function rejectCourseInvitation(string $courseId, string $userId = 'self'): mixed
    {
        $base_url = $this->base_url.COURSES.self::fmtUrl($courseId).ENROLLMENTS.self::fmtUrl($userId).'reject';

        return $this->POST($base_url, []);
    }

    /**
     * Reactivate a course enrollment
     *
     * @param  string  $userId (default=self)
     * @return mixed decoded JSON
     *
     * @throws Exception
     **/
    public function reactivateCourseEnrollment(string $courseId, string $userId = 'self'): mixed
    {
        $base_url = $this->base_url.COURSES.self::fmtUrl($courseId).ENROLLMENTS.self::fmtUrl($userId).'reactivate';

        return $this->PUT($base_url, []);
    }

    /**
     * Add last attended date of course
     *
     * @param  string  $userId (default=self)
     * @return mixed decoded JSON
     *
     * @throws Exception
     **/
    public function addLastAttendedDate(string $courseId, string $userId = 'self'): mixed
    {
        $base_url = $this->base_url.COURSES.self::fmtUrl($courseId).ENROLLMENTS.self::fmtUrl($userId).'last_attended';

        return $this->PUT($base_url, []);
    }

    /**
     * Query progress of user
     *
     * @param  string  $userId (default=self)
     * @return mixed decoded JSON
     *
     * @throws Exception
     **/
    public function queryUserProgress(string $userId = 'self'): mixed
    {
        $base_url = $this->base_url.PROGRESS.$userId;

        return $this->GET($base_url);
    }

    /**
     * Cancel user progress
     *
     * @param  string  $userId (default=self)
     * @return mixed JSON decoded
     *
     * @throws Exception
     **/
    public function cancelUserProgress(string $userId = 'self'): mixed
    {
        $base_url = $this->base_url.PROGRESS.$userId;

        return $this->POST($base_url, []);
    }

    /**
     * List Assignments for User
     *
     * @param  string  $userId (default=self)
     * @param  string  $coursrId
     * @return mixed JSON decoded
     *
     * @throws Exception
     **/
    public function listAssignmentsForUser(string $courseId, string $userId = 'self'): mixed
    {
        $base_url = $this->base_url.USERS.self::fmtUrl($userId).COURSES.self::fmtUrl($courseId).ASSIGNMENTS;

        return $this->GET($base_url);
    }

    /**
     * List Assignments for Course
     *
     * @return mixed JSON decoded
     *
     * @throws Exception
     **/
    public function listAssignmentsByCourse(string $courseId): mixed
    {
        $base_url = $this->base_url.COURSES.self::fmtUrl($courseId).ASSIGNMENTS;

        return $this->GET($base_url);
    }

    /**
     * List Assignments for Course
     *
     * @return mixed JSON decoded
     *
     * @throws Exception
     **/
    public function listAssignmentGroupsByCourse(string $assignmentGroupId, string $courseId): mixed
    {
        $base_url = $this->base_url.COURSES.self::fmtUrl($courseId).'assignment_groups/'.self::fmtUrl($assignmentGroupId).ASSIGNMENTS;

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
    public function getAssignment(string $courseId, string $assignmentId): mixed
    {
        $base_url = $this->base_url.COURSES.self::fmtUrl($courseId).ASSIGNMENTS.$assignmentId;

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
        $base_url = $this->base_url.COURSES.self::fmtUrl($courseId).ASSIGNMENTS.$assignmentInfo;

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
    public function editAssignmentForCourse(array $assignmentInfo, string $courseId, string $assignmentId): mixed
    {
        $base_url = $this->base_url.COURSES.self::fmtUrl($courseId).ASSIGNMENTS.self::fmtUrl($assignmentId).$assignmentInfo;

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
    public function submitAssignment(string $courseId, string $assignmentId, array $assignment): mixed
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
    public function getAssignmentSubmissions(string $courseId, string $assignmentId): mixed
    {
        $base_url = $this->base_url.COURSES.self::fmtUrl($courseId).ASSIGNMENTS.self::fmtUrl($assignmentId).SUBMISSIONS;

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
    public function getSubmissionsForMultipleAssignments(string $courseId): mixed
    {
        $base_url = $this->base_url.COURSES.self::fmtUrl($courseId).STUDENTS.SUBMISSIONS;

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
    public function getSubmissionForUser(string $courseId, string $assignmentId, string $userId): mixed
    {
        $base_url = $this->base_url.COURSES.self::fmtUrl($courseId).ASSIGNMENTS.self::fmtUrl($assignmentId).SUBMISSIONS.$userId;

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
    public function getSubmissionForAnonID(string $courseId, string $assignmentId, string $anonId): mixed
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
    public function uploadFileForSubmission(string $courseId, string $assignmentId, string $userId): mixed
    {
        $base_url = $this->base_url.COURSES.self::fmtUrl($courseId).ASSIGNMENTS.self::fmtUrl($assignmentId).SUBMISSIONS.self::fmtUrl($userId).'files';

        return $this->POST($base_url, []);
    }

    /*
        * Grade or comment on a submission
        *
        * @param string $courseId
        * @param string $userId
        * @param string $assignmentId
        * @return mixed decoded JSON
        * @throws Exception
        **/
    public function gradeOrCommentSubmission(string $courseId, string $assignmentId, string $userId): mixed
    {
        $base_url = $this->base_url.COURSES.self::fmtUrl($courseId).ASSIGNMENTS.self::fmtUrl($assignmentId).SUBMISSIONS.$userId;

        return $this->PUT($base_url, []);
    }

    /*
        * Grade or comment on a submission by anonymous ID
        *
        * @param string $anonId
        * @param string $assignmentId
        * @param string $courseId
        * @return mixed decoded JSON
        * @throws Exception
        **/
    public function gradeOrCommentSubmissionAnon(string $courseId, string $assignmentId, string $anonId): mixed
    {
        $base_url = $this->base_url.COURSES.self::fmtUrl($courseId).ASSIGNMENTS.self::fmtUrl($assignmentId).ANONYMOUS_SUBMISSIONS.$anonId;

        return $this->PUT($base_url, []);
    }

    /*
        * List Gradeable Students
        *
        * @param string $assignmentId
        * @param string $courseId
        * @return mixed decoded JSON
        * @throws Exception
        **/
    public function listGradeableStudents(string $courseId, string $assignmentId): mixed
    {
        $base_url = $this->base_url.COURSES.self::fmtUrl($courseId).ASSIGNMENTS.self::fmtUrl($assignmentId).GRADEABLE_STUDENTS;

        return $this->GET($base_url);
    }

    /*
        * List Multiple Assignments Gradeable Students
        *
        * @param string $courseId
        * @return mixed decoded JSON
        * @throws Exception
        **/
    public function listMultipleAssignmentsGradeableStudents(string $courseId): mixed
    {
        $base_url = $this->base_url.COURSES.self::fmtUrl($courseId).ASSIGNMENTS.GRADEABLE_STUDENTS;

        return $this->GET($base_url);
    }

    /*
        * Mark Submision as read
        *
        * @param string $userId
        * @param string $courseId
        * @param string $assignmentId
        * @return mixed decoded JSON
        * @throws Exception
        **/
    public function markSubmissionAsRead(string $courseId, string $assignmentId, string $userId = 'self'): mixed
    {
        $base_url = $this->base_url.COURSES.self::fmtUrl($courseId).ASSIGNMENTS.self::fmtUrl($assignmentId).SUBMISSIONS.self::fmtUrl($userId).READ;

        return $this->PUT($base_url, []);
    }

    /*
        * Mark Submision Item as read
        *
        * @param string $userId
        * @param string $item
        * @param string $courseId
        * @param string $assignmentId
        * @return mixed decoded JSON
        * @throws Exception
        **/
    public function markSubmissionItemAsRead(string $courseId, string $assignmentId, string $userId, string $item): mixed
    {
        $base_url = $this->base_url.COURSES.self::fmtUrl($courseId).ASSIGNMENTS.self::fmtUrl($assignmentId).SUBMISSIONS.self::fmtUrl($userId).READ.$item;

        return $this->PUT($base_url, []);
    }

    /*
        * Mark Submision as unread
        *
        * @param string $userId
        * @param string $courseId
        * @param string $assignmentId
        * @return mixed decoded JSON
        * @throws Exception
        **/
    public function markSubmissionAsUnread(string $courseId, string $assignmentId, string $userId = 'self'): mixed
    {
        $base_url = $this->base_url.COURSES.self::fmtUrl($courseId).ASSIGNMENTS.self::fmtUrl($assignmentId).SUBMISSIONS.self::fmtUrl($userId).READ;

        return $this->DELETE($base_url);
    }

    /*
        * Clear unread status for all Submisions
        * Site admin only
        * @param string $userId
        * @param string $courseId
        * @return mixed decoded JSON
        * @throws Exception
        **/
    public function clearUnreadStatusForAllSubmissions(string $courseId, string $userId = 'self'): mixed
    {
        $base_url = $this->base_url.COURSES.self::fmtUrl($courseId).SUBMISSIONS.self::fmtUrl($userId).'clear_unread';

        return $this->PUT($base_url, []);
    }

    /*
        * Get Submision summary
        *
        * @param string $courseId
        * @param string $assignmentId
        * @return mixed decoded JSON
        * @throws Exception
        **/
    public function getSubmissionSummary(string $courseId, string $assignmentId): mixed
    {
        $base_url = $this->base_url.COURSES.self::fmtUrl($courseId).ASSIGNMENTS.self::fmtUrl($assignmentId).'submission_summary';

        return $this->GET($base_url);
    }
}
