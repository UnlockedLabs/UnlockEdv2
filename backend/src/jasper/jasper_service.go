package jasper

import (
	"UnlockEdv2/src/database"
	"UnlockEdv2/src/models"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"
)

type JasperService struct {
	Db     *database.DB
	testingMode bool
}

type JasperReportData struct {
	ResidentName          string   `json:"resident_name"`
	ResidentID           string   `json:"resident_id"`
	FacilityName         string   `json:"facility_name"`
	GeneratedDate         string   `json:"generated_date"`
	DateRange            string   `json:"date_range"`
	TotalTimeSpent       string   `json:"total_time_spent"`
	TotalLogins          string   `json:"total_logins"`
	TotalResourcesAccessed string   `json:"total_resources_accessed"`
	HasProgramAccess      bool     `json:"has_program_access"`
	Programs             []models.ResidentProgramClassInfo `json:"programs"`
	LogoImage            string   `json:"logo_image"`
}

type JasperProgramData struct {
	ProgramName string `json:"program_name"`
	ClassName  string `json:"class_name"`
	Status     string `json:"status"`
	Attendance string `json:"attendance"`
	StartDate   string `json:"start_date"`
	EndDate    string `json:"end_date"`
}

func NewJasperService(db *database.DB, testingMode bool) *JasperService {
	return &JasperService{
		Db:          db,
		testingMode: testingMode,
	}
}

func (js *JasperService) GenerateUsageReportPDF(userID int) ([]byte, error) {
	user, err := js.Db.GetUserByID(uint(userID))
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	queryCtx := models.QueryContext{All: true}
	userPrograms, err := js.Db.GetUserProgramInfo(&queryCtx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user programs: %w", err)
	}

	sessionEngagements, err := js.Db.GetUserSessionEngagement(userID, -1)
	if err != nil {
		return nil, fmt.Errorf("failed to get user engagements: %w", err)
	}

	resourceCount, err := js.Db.GetUserOpenContentAccessCount(nil, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get resource count: %w", err)
	}

	reportData := JasperReportData{
		ResidentName:          fmt.Sprintf("%s %s", user.NameFirst, user.NameLast),
		ResidentID:           user.DocID,
		FacilityName:         user.Facility.Name,
		GeneratedDate:         time.Now().Format("January 2, 2006"),
		DateRange:            fmt.Sprintf("%s - present", user.CreatedAt.Format("January 2, 2006")),
		TotalTimeSpent:       js.calculateTotalTime(sessionEngagements),
		TotalLogins:          js.calculateTotalLogins(user),
		TotalResourcesAccessed: fmt.Sprintf("%d", resourceCount.TotalResourcesAccessed),
		HasProgramAccess:      js.hasFeatureAccess(models.ProgramAccess),
		Programs:             userPrograms, // Use original programs data
		LogoImage:            "logo", // Reference to logo image in JRXML
	}

	jsonData, err := json.Marshal(reportData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal report data: %w", err)
	}

	dataFile := filepath.Join(os.TempDir(), "user_usage_report_data.json")
	if err := os.WriteFile(dataFile, jsonData, 0644); err != nil {
		return nil, fmt.Errorf("failed to write data file: %w", err)
	}
	defer os.Remove(dataFile) // Cleanup

	templatePath := "templates/user_usage_report.jrxml"
	outputPath := filepath.Join(os.TempDir(), "user_usage_report.pdf")

	cmd := exec.Command("jasperstarter", 
		"process", 
		templatePath,
		"-f", "json",
		"-d", dataFile,
		"-o", outputPath,
	)

	// Execute command
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("jasperstarter command failed: %w\nOutput: %s", err, output)
	}

	// Read generated PDF
	pdfBytes, err := os.ReadFile(outputPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read generated PDF: %w", err)
	}

	defer os.Remove(outputPath) // Cleanup

	return pdfBytes, nil
}

func (js *JasperService) calculateTotalTime(engagements []models.SessionEngagement) string {
	if len(engagements) == 0 {
		return "none"
	}
	return fmt.Sprintf("%.0f minutes", engagements[0].TotalMinutes)
}

func (js *JasperService) calculateTotalLogins(user *models.User) string {
	if user.LoginMetrics == nil {
		return "0"
	}
	return fmt.Sprintf("%d", user.LoginMetrics.Total)
}

func (js *JasperService) hasFeatureAccess(feature interface{}) bool {
	// This would check feature flags in a real implementation
	return true // Simplified for demo
}
