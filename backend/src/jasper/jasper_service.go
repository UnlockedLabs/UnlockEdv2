package jasper

import (
	"UnlockEdv2/src/database"
	"UnlockEdv2/src/models"

	//"UnlockEdv2/src"
	"context"
	//"encoding/json"
	"fmt"
	//"github.com/sirupsen/logrus"
	"os"
	//"os/exec"
	///"path/filepath"
	//"time"

	"github.com/evertonvps/go-jasper"
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
	// user, err := js.Db.GetUserByID(uint(userID))
	// if err != nil {
	// 	return nil, fmt.Errorf("failed to get user: %w", err)
	// }

	// userPrograms, err := js.Db.GetUserProgramInfo(js.queryCtx, userID)
	// if err != nil {
	// 	return nil, fmt.Errorf("failed to get user programs: %w", err)
	// }

	// sessionEngagements, err := js.Db.GetUserSessionEngagement(userID, -1)
	// if err != nil {
	// 	return nil, fmt.Errorf("failed to get user engagements: %w", err)
	// }

	// resourceCount, err := js.Db.GetUserOpenContentAccessCount(context.TODO(), userID)
	// if err != nil {
	// 	return nil, fmt.Errorf("failed to get resource count: %w", err)
	// }

	// reportData := JasperReportData{
	// 	ResidentName:           fmt.Sprintf("%s %s", user.NameFirst, user.NameLast),
	// 	ResidentID:             user.DocID,
	// 	FacilityName:           user.Facility.Name,
	// 	GeneratedDate:          time.Now().Format("January 2, 2006"),
	// 	DateRange:              fmt.Sprintf("%s - present", user.CreatedAt.Format("January 2, 2006")),
	// 	TotalTimeSpent:         js.calculateTotalTime(sessionEngagements),
	// 	TotalLogins:            js.calculateTotalLogins(user),
	// 	TotalResourcesAccessed: fmt.Sprintf("%d", resourceCount.TotalResourcesAccessed),
	// 	HasProgramAccess:       js.hasFeatureAccess(models.ProgramAccess),
	// 	Programs:               userPrograms, // Use original programs data
	// 	LogoImage:              "logo",       // Reference to logo image in JRXML
	// }

	// jsonData, err := json.Marshal(reportData)
	// if err != nil {
	// 	return nil, fmt.Errorf("failed to marshal report data: %w", err)
	// }

	// dataFile := filepath.Join(os.TempDir(), "user_usage_report_data.json")

	// //TODO: DONT FORGET TO REMOVE!
	// jsonPreview := string(jsonData)
	// if len(jsonPreview) > 500 {
	// 	jsonPreview = jsonPreview[:500] + "..."
	// }
	// logrus.WithFields(logrus.Fields{
	// 	"user_id":          userID,
	// 	"json_data_length": len(jsonData),
	// 	"json_preview":     jsonPreview,
	// 	"data_file_path":   dataFile,
	// }).Info("DEBUG: JSON data being sent to JasperReports")
	// if err := os.WriteFile(dataFile, jsonData, 0644); err != nil {
	// 	return nil, fmt.Errorf("failed to write data file: %w", err)
	// }
	// defer func() {
	// 	if err := os.Remove(dataFile); err != nil {
	// 		logrus.WithFields(logrus.Fields{
	// 			"data_file": dataFile,
	// 			"error":     err,
	// 		}).Warn("Failed to remove temporary data file")
	// 	}
	// }()

	// // Write logo image to temporary file for JasperReports
	// logoFile := "/tmp/unlocked-logo.png"
	// if err := os.WriteFile(logoFile, src.UnlockedLogoImg, 0644); err != nil {
	// 	return nil, fmt.Errorf("failed to write logo file: %w", err)
	// }
	// defer func() {
	// 	if err := os.Remove(logoFile); err != nil {
	// 		logrus.WithFields(logrus.Fields{
	// 			"logo_file": logoFile,
	// 			"error":     err,
	// 		}).Warn("Failed to remove temporary logo file")
	// 	}
	// }()

	// // Create jdbc directory for JasperStarter
	// jdbcDir := "/tmp/jdbc"
	// if err := os.MkdirAll(jdbcDir, 0755); err != nil {
	// 	return nil, fmt.Errorf("failed to create jdbc directory: %w", err)
	// }

	// outputPath := filepath.Join(os.TempDir(), "user_usage_report")

	// // Correct JasperStarter command with proper template path and arguments
	// cmd := exec.Command("java",
	// 	"-Djava.awt.headless=true",
	// 	"-Dfile.encoding=UTF-8",
	// 	"-Dsun.java2d.fontconfig=true",
	// 	"-cp", "/opt/jasperstarter/jasperstarter.jar:/opt/jasperstarter/lib/*",
	// 	"de.cenote.jasperstarter.App",
	// 	"pr",
	// 	"-t", "json",
	// 	"-f", "pdf",
	// 	"--data-file", dataFile,
	// 	"--jdbc-dir", jdbcDir,
	// 	"-o", outputPath,
	// 	"/templates/user_usage_report.jrxml",
	// )

	// cmd.Dir = "/app"

	// output, err := cmd.CombinedOutput()
	// if err != nil {
	// 	return nil, fmt.Errorf("jasperstarter command failed: %w\nOutput: %s", err, output)
	// }

	// pdfBytes, err := os.ReadFile(outputPath + ".pdf")
	// if err != nil {
	// 	return nil, fmt.Errorf("failed to read generated PDF: %w", err)
	// }

	// defer func() {
	// 	if err := os.Remove(outputPath + ".pdf"); err != nil {
	// 		logrus.WithFields(logrus.Fields{
	// 			"output_file": outputPath + ".pdf",
	// 			"error":       err,
	// 		}).Warn("Failed to remove generated PDF file")
	// 	}
	// }()

	// return pdfBytes, nil

	// Test implementation for go-jasper integration
	outputFile := "/app/backend/src/templates/report"
	jsonData := `[{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}]`
	jsonFile := "data.json"

	err := os.WriteFile(jsonFile, []byte(jsonData), 0644)
	if err != nil {
		fmt.Println("error while processing: ", err)
	}
	defer os.Remove(jsonFile) // Clean up the dummy file


	gjr := jasper.NewGoJasperJsonData(jsonFile, "", nil, "pdf", outputFile)

	// Set the path to the jasperstarter executable
	//gjr.Executable = "./jasperstarter/bin/jasperstarter"
	//FIXME can remove this
	err = gjr.Compile("/app/backend/src/templates/report.jrxml")
	if err != nil {
		fmt.Println("error while compiling: ", err)
		//log.Fatalf("Error compiling report: %v", err)
	}

	// 6. Process the report to generate the output.
	pdfBytes, err := gjr.Process("/app/backend/src/templates/report.jasper")
	if err != nil {
		fmt.Println("error while processing jasper: ", err)
		//log.Fatalf("Error processing report: %v", err)
	}

	fmt.Println(string(pdfBytes))
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
