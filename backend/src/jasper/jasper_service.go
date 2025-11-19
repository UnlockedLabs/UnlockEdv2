package jasper

import (
	"UnlockEdv2/src"
	"UnlockEdv2/src/database"
	"UnlockEdv2/src/models"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/evertonvps/go-jasper"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
)

type JasperService struct {
	Db          *database.DB
	queryCtx    *models.QueryContext
	testingMode bool
}

type JasperReportData struct {
	ResidentName           string                            `json:"resident_name"`
	ResidentID             string                            `json:"resident_id"`
	FacilityName           string                            `json:"facility_name"`
	GeneratedDate          string                            `json:"generated_date"`
	DateRange              string                            `json:"date_range"`
	TotalTimeSpent         string                            `json:"total_time_spent"`
	TotalLogins            string                            `json:"total_logins"`
	TotalResourcesAccessed string                            `json:"total_resources_accessed"`
	HasProgramAccess       bool                              `json:"has_program_access"`
	Programs               []models.ResidentProgramClassInfo `json:"programs"`
	LogoImage              string                            `json:"logo_image"`
}

type JasperProgramData struct {
	ProgramName string `json:"program_name"`
	ClassName   string `json:"class_name"`
	Status      string `json:"status"`
	Attendance  string `json:"attendance"`
	StartDate   string `json:"start_date"`
	EndDate     string `json:"end_date"`
}

func NewJasperService(db *database.DB, testingMode bool) *JasperService {
	return &JasperService{
		Db:          db,
		queryCtx:    &models.QueryContext{All: true, Ctx: context.TODO()},
		testingMode: testingMode,
	}
}

func NewJasperServiceWithContext(db *database.DB, queryCtx *models.QueryContext, testingMode bool) *JasperService {
	return &JasperService{
		Db:          db,
		queryCtx:    queryCtx,
		testingMode: testingMode,
	}
}

func (js *JasperService) GenerateUsageReportPDF(userID int) ([]byte, error) {
	user, err := js.Db.GetUserByID(uint(userID))
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	userPrograms, err := js.Db.GetUserProgramInfo(js.queryCtx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user programs: %w", err)
	}

	sessionEngagements, err := js.Db.GetUserSessionEngagement(userID, -1)
	if err != nil {
		return nil, fmt.Errorf("failed to get user engagements: %w", err)
	}

	resourceCount, err := js.Db.GetUserOpenContentAccessCount(context.TODO(), userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get resource count: %w", err)
	}

	reportData := JasperReportData{
		ResidentName:           fmt.Sprintf("%s %s", user.NameFirst, user.NameLast),
		ResidentID:             user.DocID,
		FacilityName:           user.Facility.Name,
		GeneratedDate:          time.Now().Format("January 2, 2006"),
		DateRange:              fmt.Sprintf("%s - present", user.CreatedAt.Format("January 2, 2006")),
		TotalTimeSpent:         js.calculateTotalTime(sessionEngagements),
		TotalLogins:            js.calculateTotalLogins(user),
		TotalResourcesAccessed: fmt.Sprintf("%d", resourceCount.TotalResourcesAccessed),
		HasProgramAccess:       js.hasFeatureAccess(models.ProgramAccess),
		Programs:               userPrograms, // Use original programs data
		LogoImage:              "logo",       // Reference to logo image in JRXML
	}

	// Marshal report data to JSON
	jsonData, err := json.Marshal(reportData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal report data: %w", err)
	}

	fmt.Println(string(jsonData))
	// Create temporary JSON file with unique name
	tempDir := "/tmp" // Use /tmp for jasperstarter accessibility
	jsonFileName := fmt.Sprintf("jasper_report_%s.json", uuid.New().String())
	jsonFilePath := filepath.Join(tempDir, jsonFileName)

	logrus.WithFields(logrus.Fields{
		"user_id":          userID,
		"json_data_length": len(jsonData),
		"json_file_path":   jsonFilePath,
	}).Info("Creating temporary JSON file for JasperReports")

	// Write JSON data to temporary file
	if err := os.WriteFile(jsonFilePath, jsonData, 0644); err != nil {
		return nil, fmt.Errorf("failed to write temporary data file: %w", err)
	}
	defer func() {
		if err := os.Remove(jsonFilePath); err != nil {
			logrus.WithFields(logrus.Fields{
				"json_file": jsonFilePath,
				"error":     err,
			}).Warn("Failed to remove temporary JSON file")
		} else {
			logrus.WithField("json_file", jsonFilePath).Info("Successfully removed temporary JSON file")
		}
	}()

	// Write logo image to temporary file for JasperReports with fixed name that template expects
	logoFilePath := filepath.Join(tempDir, "unlocked-logo.png")

	if err := os.WriteFile(logoFilePath, src.UnlockedLogoImg, 0644); err != nil {
		return nil, fmt.Errorf("failed to write temporary logo file: %w", err)
	}
	defer func() {
		if err := os.Remove(logoFilePath); err != nil {
			logrus.WithFields(logrus.Fields{
				"logo_file": logoFilePath,
				"error":     err,
			}).Warn("Failed to remove temporary logo file")
		} else {
			logrus.WithField("logo_file", logoFilePath).Info("Successfully removed temporary logo file")
		}
	}()

	// Create jdbc directory for JasperStarter
	jdbcDir := "/tmp/jdbc"
	if err := os.MkdirAll(jdbcDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create jdbc directory: %w", err)
	}
	defer func() {
		if err := os.RemoveAll(jdbcDir); err != nil {
			logrus.WithFields(logrus.Fields{
				"jdbc_dir": jdbcDir,
				"error":    err,
			}).Warn("Failed to remove jdbc directory")
		}
	}()

	// Prepare output path for Jasper report
	outputFile := filepath.Join(tempDir, fmt.Sprintf("jasper_report_%s", uuid.New().String()))

	logrus.WithFields(logrus.Fields{
		"json_file":     jsonFilePath,
		"logo_file":     logoFilePath,
		"jdbc_dir":      jdbcDir,
		"output_path":   outputFile,
		"template_path": "/app/backend/src/templates/user_usage_report.jrxml",
	}).Info("Processing Jasper report with temporary files")

	// Initialize go-jasper with proper file path
	gjr := jasper.NewGoJasperJsonData(jsonFilePath, "", nil, "pdf", outputFile)

	// Compile Jasper template
	compiledTemplatePath := "/app/backend/src/templates/user_usage_report.jasper"
	templatePath := "/app/backend/src/templates/user_usage_report.jrxml"

	// Always compile to ensure we have the latest version
	logrus.Info("Compiling Jasper template from JRXML")
	err = gjr.Compile(templatePath)
	if err != nil {
		return nil, fmt.Errorf("failed to compile Jasper template: %w", err)
	}

	// Process the report to generate PDF
	// Try to use the compiled template, fallback to JRXML if compilation failed
	pdfBytes, err := gjr.Process(compiledTemplatePath)
	if err != nil {
		logrus.WithFields(logrus.Fields{
			"template_path": compiledTemplatePath,
			"error":         err,
		}).Warn("Failed to process compiled template, falling back to JRXML")

		// Fallback: Try processing with JRXML directly
		pdfBytes, err = gjr.Process(templatePath)
		if err != nil {
			return nil, fmt.Errorf("failed to process Jasper report with both compiled and JRXML template: %w", err)
		}
	}

	logrus.WithFields(logrus.Fields{
		"user_id":    userID,
		"pdf_length": len(pdfBytes),
	}).Info("Successfully generated Jasper PDF report")

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

func (js *JasperService) hasFeatureAccess(feature any) bool {
	_ = feature // Suppress unused parameter warning
	return true
}
