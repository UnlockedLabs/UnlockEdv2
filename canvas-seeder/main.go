package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"

	"github.com/brianvoe/gofakeit/v6"
	"github.com/joho/godotenv"
)

const post = "POST"
const put = "PUT"

const defaultAssignments = 10
const defaultCourses = 3
const defaultUsers = 10

func createCourse(apiToken string,
	canvasURL string) ([]map[string]interface{}, error) {

	coursesUrl := fmt.Sprintf("%s/api/v1/accounts/self/courses", canvasURL)
	payload := url.Values{}
	payload.Set("course[name]", gofakeit.Sentence(5))
	payload.Set("course[course_code]", fmt.Sprintf("%s%d", gofakeit.LetterN(2), gofakeit.Number(100, 500)))
	payload.Set("course[description]", gofakeit.Sentence(8))
	payload.Set("course[is_public]", "True")
	payload.Set("course[workflow_state]", "available")
	payload.Set("course[default_view]", "assignments")
	payload.Set("offer", "True")

	resp, err := requestUrlTokenPayload(post, coursesUrl, apiToken, payload.Encode(), nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	data, err := jsonRespToMapSlice(resp)
	if err != nil {
		return nil, err
	}

	return data, nil
}

func createCourseAssignments(apiToken string,
	canvasURL string,
	users []map[string]interface{},
	courseId string,
	targetAssignments int) error {
	assignmentsUrl := fmt.Sprintf("%s/api/v1/courses/%v/assignments", canvasURL, courseId)

	submission_limit := make(map[int]int)
	for u := range users {
		submission_limit[u] = rand.Intn(targetAssignments) + 1
	}
	for i := 1; i <= targetAssignments; i++ {
		payload := url.Values{}
		payload.Set("assignment[position]", strconv.Itoa(i))
		payload.Set("assignment[name]", fmt.Sprintf("%d. %s", i, gofakeit.Sentence(5)))
		payload.Set("assignment[description]", gofakeit.Sentence(7))
		payload.Set("assignment[submission_types]", "online_text_entry")
		payload.Set("assignment[points_possible]", "100")
		payload.Set("assignment[published]", "true")
		payload.Set("assignment[hide_in_gradebook]", "false")
		payload.Set("assignment[omit_from_final_grade]", "false")

		resp, err := requestUrlTokenPayload(post, assignmentsUrl, apiToken, payload.Encode(), nil)
		if err != nil {
			return err
		}
		defer resp.Body.Close()

		assignment, err := jsonRespToMapSlice(resp)
		if err != nil {
			return err
		}

		assignmentId, err := interfaceToString(assignment[0]["id"])
		if err != nil {
			return err
		}

		fmt.Printf("Created assignment_id %v for course_id %v\n", assignmentId, courseId)

		for u, user := range users {
			// Skip Teacher
			if u == 0 {
				continue
			}
			userId, err := interfaceToString(user["id"])
			if err != nil {
				return err
			}
			if i <= submission_limit[u] {
				createCourseAssignmentSubmission(apiToken, canvasURL, courseId, assignmentId, userId)
				createCourseAssignmentSubmissionGrade(apiToken, canvasURL, courseId, assignmentId, userId)
			}
		}
	}

	return nil
}

func createCourseAssignmentSubmission(apiToken string,
	canvasURL string,
	courseId string,
	assignmentId string,
	userId string) error {

	submissionsUrl := fmt.Sprintf("%s/api/v1/courses/%v/assignments/%v/submissions", canvasURL, courseId, assignmentId)
	payload := url.Values{}
	payload.Set("submission[submission_type]", "online_text_entry")
	payload.Set("submission[body]", gofakeit.Paragraph(1, 5, 30, ""))
	payload.Set("submission[user_id]", userId)

	resp, err := requestUrlTokenPayload(post, submissionsUrl, apiToken, payload.Encode(), nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	submission, err := jsonRespToMapSlice(resp)
	if err != nil {
		return err
	}

	fmt.Printf("Submitted assignment ID %v for course ID %v for user ID %v with submission ID %v\n", assignmentId, courseId, userId, submission[0]["id"])

	return nil
}

func createCourseAssignmentSubmissionGrade(apiToken string,
	canvasURL string,
	courseId string,
	assignmentId string,
	userId string) error {

	submissionsUrl := fmt.Sprintf("%s/api/v1/courses/%v/assignments/%v/submissions/%v", canvasURL, courseId, assignmentId, userId)
	grade := gofakeit.Number(60, 100)
	body := fmt.Sprintf("{\"submission\": {\"posted_grade\":\"%v\"}}", grade)

	headers := make(map[string]string)
	headers["Content-Type"] = "application/json"
	resp, err := requestUrlTokenPayload(put, submissionsUrl, apiToken, body, headers)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	fmt.Printf("Graded %v assignment ID %v for course ID %v for user ID %v\n", grade, assignmentId, courseId, userId)

	return nil
}

func createUser(apiToken string,
	canvasURL string) ([]map[string]interface{}, error) {
	usersUrl := fmt.Sprintf("%s/api/v1/accounts/self/users", canvasURL)

	payload := url.Values{}
	payload.Set("user[name]", gofakeit.Name())
	payload.Set("pseudonym[unique_id]", gofakeit.Email())
	payload.Set("pseudonym[password]", gofakeit.Password(true, true, true, false, false, 12))
	payload.Set("pseudonym[send_confirmation]", "false")
	payload.Set("user[skip_registration]", "true")
	payload.Set("communication_channel[skip_confirmation]", "true")

	resp, err := requestUrlTokenPayload("POST", usersUrl, apiToken, payload.Encode(), nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	userData, err := jsonRespToMapSlice(resp)
	if err != nil {
		return nil, err
	}

	return userData, nil
}

func enrollAllUsers(apiToken string,
	canvasURL string,
	users []map[string]interface{},
	courseId interface{}) error {

	enrollmentsUrl := fmt.Sprintf("%s/api/v1/courses/%v/enrollments", canvasURL, courseId)

	for i, user := range users {
		userId, err := interfaceToString(user["id"])
		if err != nil {
			return err
		}

		enrollmentType := "StudentEnrollment"
		if i == 0 {
			enrollmentType = "TeacherEnrollment"
		}

		user["enrollment_type"] = enrollmentType
		payload := url.Values{}
		payload.Set("enrollment[user_id]", userId)
		payload.Set("enrollment[type]", enrollmentType)
		payload.Set("enrollment[enrollment_state]", "active")

		fmt.Printf("Enrolling %v course_id %v as %s\n", userId, courseId, enrollmentType)
		_, err = requestUrlTokenPayload(post, enrollmentsUrl, apiToken, payload.Encode(), nil)
		if err != nil {
			return err
		}
	}

	return nil
}

func interfaceToString(value interface{}) (string, error) {
	switch v := value.(type) {
	case int:
		return strconv.Itoa(v), nil
	case float64:
		return strconv.FormatFloat(v, 'f', -1, 64), nil
	case string:
		return v, nil
	default:
		return "", fmt.Errorf("unsupported type: %T", value)
	}
}

func jsonRespToMapSlice(resp *http.Response) ([]map[string]interface{}, error) {
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("error reading response body: %s", err)
	}

	// Check if the response is an array or a single object
	var dataSlice []map[string]interface{}
	var dataMap map[string]interface{}
	err = json.Unmarshal(body, &dataSlice)
	if err == nil {
		// Response is an array
		return dataSlice, nil
	}

	// Try parsing as a single object
	err = json.Unmarshal(body, &dataMap)
	if err != nil {
		return nil, fmt.Errorf("error parsing JSON: %s", err)
	}

	// Convert single object to a slice containing one element
	dataSlice = append(dataSlice, dataMap)
	return dataSlice, nil
}

func requestUrlTokenPayload(method string,
	url string,
	apiToken string,
	body string,
	headers map[string]string) (*http.Response, error) {
	req, err := http.NewRequest(method, url, strings.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("error creating request: %s", err)
	}
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", apiToken))
	for key, value := range headers {
		req.Header.Set(key, value)
	}

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("error retrieving data: %s", err)
	}

	return resp, nil
}

func retrieveCourses(apiToken string,
	canvasURL string) ([]map[string]interface{}, error) {
	endPoint := "/api/v1/accounts/self/courses"
	url := canvasURL + endPoint

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("error creating request: %s", err)
	}
	req.Header.Set("Authorization", "Bearer "+apiToken)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("error sending request: %s", err)
	}
	defer resp.Body.Close()

	data, err := jsonRespToMapSlice(resp)
	if err != nil {
		return nil, err
	}

	return data, nil
}

func retrieveUsers(apiToken string,
	canvasURL string) ([]map[string]interface{}, error) {
	endPoint := "/api/v1/accounts/self/users"
	url := canvasURL + endPoint

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("error creating request: %s", err)
	}
	req.Header.Set("Authorization", "Bearer "+apiToken)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("error sending request: %s", err)
	}
	defer resp.Body.Close()

	data, err := jsonRespToMapSlice(resp)
	if err != nil {
		return nil, err
	}

	return data, nil
}

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}

	apiToken := os.Getenv("API_TOKEN")
	canvasURL := os.Getenv("CANVAS_URL")
	targetAssignmentsStr := os.Getenv("TARGET_ASSIGNMENTS")
	targetCoursesStr := os.Getenv("TARGET_COURSES")
	targetUsersStr := os.Getenv("TARGET_USERS")

	targetAssignments := defaultAssignments
	targetCourses := defaultCourses
	targetUsers := defaultUsers

	if apiToken == "" || canvasURL == "" {
		log.Fatal("API_TOKEN or CANVAS_URL not set in environment variables")
	}

	if targetAssignmentsStr != "" {
		targetAssignments, err = strconv.Atoi(targetAssignmentsStr)
		if err != nil {
			log.Fatal("error parsing TARGET_ASSIGNMENTS:", err)
		}
	}

	if targetCoursesStr != "" {
		targetCourses, err = strconv.Atoi(targetCoursesStr)
		if err != nil {
			log.Fatal("error parsing TARGET_COURSES:", err)
		}
	}

	if targetUsersStr != "" {
		targetUsers, err = strconv.Atoi(targetUsersStr)
		if err != nil {
			log.Fatal("error parsing TARGET_USERS:", err)
		}
	}

	users, err := retrieveUsers(apiToken, canvasURL)
	if err != nil {
		log.Fatal("error retrieving users:", err)
	}

	// Create users up to targetUsers
	for i := len(users); i < targetUsers; i++ {
		_, err := createUser(apiToken, canvasURL)
		if err != nil {
			log.Fatal("error creating user:", err)
		}
	}

	users, err = retrieveUsers(apiToken, canvasURL)
	if err != nil {
		log.Fatal("error retrieving users:", err)
	}

	courses, err := retrieveCourses(apiToken, canvasURL)
	if err != nil {
		log.Fatal("error retrieving courses:", err)
	}
	// Create courses up to targetCourses
	for i := len(courses); i < targetCourses; i++ {
		newCourses, err := createCourse(apiToken, canvasURL)
		if err != nil {
			log.Fatal("error creating courses:", err)
		}
		for _, course := range newCourses {
			courseId, err := interfaceToString(course["id"])
			if err != nil {
				log.Fatal("error converting course ID:", err)
			}
			fmt.Printf("Created course_id %v %s\n", courseId, course["name"])
			err = enrollAllUsers(apiToken, canvasURL, users, courseId)
			if err != nil {
				log.Fatal("error enrolling users:", err)
			}
			err = createCourseAssignments(apiToken, canvasURL, users, courseId, targetAssignments)
			if err != nil {
				log.Fatal("error creating course assignments:", err)
			}
		}
	}
}
