<?php

namespace Tests\MockIntegrations;

class MockCanvasServices
{
    public function __call($method, $arguments)
    {
        $jsonBaseName = 'Canvas';
        $methodName = $jsonBaseName.ucfirst($method); // Prefix method name with 'Canvas'
        $mockDataFile = base_path("tests/Fixtures/{$methodName}.json");

        if (! file_exists($mockDataFile)) {
            throw new \Exception("Mock data file {$mockDataFile} does not exist.");
        }

        return json_decode(file_get_contents($mockDataFile), true);
    }

    public function listCourses()
    {
        return $this->__call(__FUNCTION__, func_get_args());
    }

    public function listAuthenticationProviders()
    {
        return $this->__call(__FUNCTION__, func_get_args());
    }

    public function createUserLogin(int $userId)
    {
        return $this->__call(__FUNCTION__, func_get_args());
    }

    public function listUsers()
    {
        return $this->__call(__FUNCTION__, func_get_args());
    }

    public function showUserDetails()
    {
        return $this->__call(__FUNCTION__, func_get_args());
    }

    public function createStudent(string $name, string $email, bool $terms = true)
    {
        return $this->__call(__FUNCTION__, func_get_args());
    }

    public function listActivityStream()
    {
        return $this->__call(__FUNCTION__, func_get_args());
    }

    public function listActivityStreamSummary()
    {
        return $this->__call(__FUNCTION__, func_get_args());
    }

    public function listTodoItems()
    {
        return $this->__call(__FUNCTION__, func_get_args());
    }

    public function listUpcomingAssignments()
    {
        return $this->__call(__FUNCTION__, func_get_args());
    }

    public function listMissingSubmissions()
    {
        return $this->__call(__FUNCTION__, func_get_args());
    }

    public function listCoursesForUser()
    {
        return $this->__call(__FUNCTION__, func_get_args());
    }

    public function listUserCourseProgress(string $userId, string $courseId)
    {
        return $this->__call(__FUNCTION__, func_get_args());
    }

    public function listEnrollmentsForUser()
    {
        return $this->__call(__FUNCTION__, func_get_args());
    }

    public function listEnrollmentsByCourse(string $courseId)
    {
        return $this->__call(__FUNCTION__, func_get_args());
    }

    public function listEnrollmentsBySection(string $sectionId)
    {
        return $this->__call(__FUNCTION__, func_get_args());
    }

    public function enrollUser(int $userId, int $courseId)
    {
        return $this->__call(__FUNCTION__, func_get_args());
    }

    public function listAssignmentsForUser(string $courseId, string $userId = 'self')
    {
        return $this->__call(__FUNCTION__, func_get_args());
    }

    public function listAssignmentsByCourse(string $courseId)
    {
        return $this->__call(__FUNCTION__, func_get_args());
    }

    public function listAssignmentGroupsByCourse(string $assignmentGroupId, string $courseId)
    {
        return $this->__call(__FUNCTION__, func_get_args());
    }

    public function getAssignment(string $courseId, string $assignmentId)
    {
        return $this->__call(__FUNCTION__, func_get_args());
    }

    public function listSubmissionsForUser(string $courseId, string $assignmentId, string $userId)
    {
        return $this->__call(__FUNCTION__, func_get_args());
    }

    public function listSubmissionSummary(string $courseId, string $assignmentId)
    {
        return $this->__call(__FUNCTION__, func_get_args());
    }

    public function getUserCourseProgress(string $userId, string $courseId)
    {
        return $this->__call(__FUNCTION__, func_get_args());
    }

    public function getActivityStreamSummary()
    {
        return $this->__call(__FUNCTION__, func_get_args());
    }
}
