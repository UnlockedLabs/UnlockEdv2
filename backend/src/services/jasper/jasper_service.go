package jasper

import (
	"UnlockEdv2/src/models"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type Service struct {
	client    *http.Client
	baseURL   string
	timeout   time.Duration
}

type UsageReportRequest struct {
	User          UserInfo          `json:"user"`
	TotalMinutes  float64           `json:"totalMinutes"`
	TotalResources int64            `json:"totalResources"`
	Programs      []ProgramInfo     `json:"programs"`
}

type UserInfo struct {
	NameFirst    string `json:"nameFirst"`
	NameLast     string `json:"nameLast"`
	DocID        string `json:"docId"`
	FacilityName string `json:"facilityName"`
	CreatedAt    string `json:"createdAt"`
	TotalLogins  int    `json:"totalLogins"`
}

type ProgramInfo struct {
	ProgramName          string `json:"programName"`
	ClassName            string `json:"className"`
	Status               string `json:"status"`
	AttendancePercentage string `json:"attendancePercentage"`
	StartDate            string `json:"startDate"`
	EndDate              string `json:"endDate"`
}

func NewService(baseURL string) *Service {
	return &Service{
		client:  &http.Client{Timeout: 30 * time.Second},
		baseURL: baseURL,
		timeout: 30 * time.Second,
	}
}

func (s *Service) GenerateUsageReportPDF(ctx context.Context, user *models.User, programs []models.ResidentProgramClassInfo, engagements []models.SessionEngagement, resourceCount int64) ([]byte, error) {
	if len(programs) == 0 {
		programs = []models.ResidentProgramClassInfo{}
	}
	if len(engagements) == 0 {
		engagements = []models.SessionEngagement{}
	}

	userInfo := UserInfo{
		NameFirst:    user.NameFirst,
		NameLast:     user.NameLast,
		DocID:        user.DocID,
		FacilityName: user.Facility.Name,
		CreatedAt:    user.CreatedAt.Format("January 2, 2006"),
	}

	if user.LoginMetrics != nil {
		userInfo.TotalLogins = int(user.LoginMetrics.Total)
	}

	totalMinutes := 0.0
	if len(engagements) > 0 {
		totalMinutes = engagements[0].TotalMinutes
	}

	var programInfos []ProgramInfo
	for _, program := range programs {
		programInfos = append(programInfos, ProgramInfo{
			ProgramName:          program.ProgramName,
			ClassName:            program.ClassName,
			Status:               string(program.Status),
			AttendancePercentage: program.CalculateAttendancePercentage(),
			StartDate:            formatDateForDisplay(program.StartDate),
			EndDate:              formatDateForDisplay(program.EndDate),
		})
	}

	request := UsageReportRequest{
		User:          userInfo,
		TotalMinutes:  totalMinutes,
		TotalResources: resourceCount,
		Programs:      programInfos,
	}

	jsonData, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", s.baseURL+"/api/reports/usage-report", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("jasper service returned status %d: %s", resp.StatusCode, string(body))
	}

	return io.ReadAll(resp.Body)
}

func formatDateForDisplay(dateStr string) string {
	if dateStr == "" {
		return ""
	}
	return dateStr
}