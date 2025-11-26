package handlers

import (
	"UnlockEdv2/src/models"
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TimePtr(t time.Time) *time.Time {
	return &t
}

func TestHandleEnrollUsersInClass_Validation(t *testing.T) {
	srv := newTestingServer()

	// Setup Common Data
	facility := models.Facility{Name: "Test Facility"}
	if err := srv.Db.Create(&facility).Error; err != nil {
		t.Fatal(err)
	}

	program := models.Program{Name: "Test Program"}
	if err := srv.Db.Create(&program).Error; err != nil {
		t.Fatal(err)
	}

	activeUser := models.User{Username: "active_user", NameFirst: "Active", NameLast: "User", FacilityID: facility.ID}
	if err := srv.Db.Create(&activeUser).Error; err != nil {
		t.Fatal(err)
	}

	activeUser2 := models.User{Username: "active_user_2", NameFirst: "Active", NameLast: "User2", FacilityID: facility.ID}
	if err := srv.Db.Create(&activeUser2).Error; err != nil {
		t.Fatal(err)
	}

	deactivatedUser := models.User{Username: "deactivated_user", NameFirst: "Deactivated", NameLast: "User", FacilityID: facility.ID, DeactivatedAt: TimePtr(time.Now())}
	if err := srv.Db.Create(&deactivatedUser).Error; err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name           string
		classStatus    models.ClassStatus
		isArchived     bool
		targetUsers    []models.User
		capacity       int64
		setupClass     func(*models.ProgramClass) // Optional extra setup
		expectedStatus int
		expectedMsg    string
	}{
		{
			name:           "Enroll in Active Class (Success)",
			classStatus:    models.Active,
			targetUsers:    []models.User{activeUser},
			capacity:       10,
			expectedStatus: http.StatusCreated,
			expectedMsg:    "users enrolled",
		},
		{
			name:           "Enroll in Scheduled Class (Success)",
			classStatus:    models.Scheduled,
			targetUsers:    []models.User{activeUser},
			capacity:       10,
			expectedStatus: http.StatusCreated,
			expectedMsg:    "users enrolled",
		},
		{
			name:           "Enroll in Completed Class (Failure)",
			classStatus:    models.Completed,
			targetUsers:    []models.User{activeUser},
			capacity:       10,
			expectedStatus: http.StatusBadRequest,
			expectedMsg:    "cannot perform action on class that is completed cancelled or archived",
		},
		{
			name:           "Enroll in Cancelled Class (Failure)",
			classStatus:    models.Cancelled,
			targetUsers:    []models.User{activeUser},
			capacity:       10,
			expectedStatus: http.StatusBadRequest,
			expectedMsg:    "cannot perform action on class that is completed cancelled or archived",
		},
		{
			name:           "Enroll in Archived Class (Failure)",
			classStatus:    models.Active,
			isArchived:     true,
			targetUsers:    []models.User{activeUser},
			capacity:       10,
			expectedStatus: http.StatusBadRequest,
			expectedMsg:    "cannot perform action on class that is completed cancelled or archived",
		},
		{
			name:           "Enroll Deactivated User (Failure)",
			classStatus:    models.Active,
			targetUsers:    []models.User{deactivatedUser},
			capacity:       10,
			expectedStatus: http.StatusBadRequest,
			expectedMsg:    "deactivated user",
		},
		{
			name:        "Enroll in Full Class (Partial/Skipped)",
			classStatus: models.Active,
			targetUsers: []models.User{activeUser, activeUser2},
			capacity:    1, // Capacity 1, trying to enroll 2 users
			setupClass: func(c *models.ProgramClass) {
			},
			expectedStatus: http.StatusCreated,
			expectedMsg:    "1 users were enrolled, 1 were not added because capacity is full.",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			class := models.ProgramClass{
				Name:           "Test Class",
				ProgramID:      program.ID,
				FacilityID:     facility.ID,
				Status:         tt.classStatus,
				InstructorName: "Instructor",
				Description:    "Description",
				Capacity:       tt.capacity,
				StartDt:        time.Now(),
			}
			if tt.isArchived {
				class.ArchivedAt = TimePtr(time.Now())
			}
			if err := srv.Db.Create(&class).Error; err != nil {
				t.Fatal(err)
			}

			if tt.setupClass != nil {
				tt.setupClass(&class)
			}

			userIDs := make([]int, len(tt.targetUsers))
			for i, u := range tt.targetUsers {
				userIDs[i] = int(u.ID)
			}

			enrollmentReq := struct {
				UserIDs []int `json:"user_ids"`
			}{
				UserIDs: userIDs,
			}
			body, _ := json.Marshal(enrollmentReq)

			req := httptest.NewRequest(http.MethodPost, "/api/program-classes/"+strconv.Itoa(int(class.ID))+"/enrollments", bytes.NewReader(body))
			req.SetPathValue("class_id", strconv.Itoa(int(class.ID)))

			w := httptest.NewRecorder()
			log := sLog{f: make(map[string]interface{})}

			err := srv.handleEnrollUsersInClass(w, req, log)

			if tt.expectedStatus >= 400 {
				assert.Error(t, err)
				svcErr, ok := err.(serviceError)
				assert.True(t, ok)
				assert.Equal(t, tt.expectedStatus, svcErr.Status)
				assert.Contains(t, svcErr.Message, tt.expectedMsg)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedStatus, w.Code)
				// For 201, the response body is a JSON object with a message
				var resp models.Resource[any]
				err := json.Unmarshal(w.Body.Bytes(), &resp)
				assert.NoError(t, err)
				assert.Contains(t, resp.Message, tt.expectedMsg)
			}
		})
	}
}
