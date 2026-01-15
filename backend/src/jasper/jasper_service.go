package jasper

import (
	"UnlockEdv2/src"
	"UnlockEdv2/src/database"
	"UnlockEdv2/src/models"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/evertonvps/go-jasper"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
)

type jasperService struct {
	db               *database.DB
	queryCtx         *models.QueryContext
	hasProgramAccess bool
}

func newJasperServiceWithContext(db *database.DB, queryCtx *models.QueryContext, hasProgramAccess bool) *jasperService {
	return &jasperService{
		db:               db,
		queryCtx:         queryCtx,
		hasProgramAccess: hasProgramAccess,
	}
}

func (js *jasperService) generateUsageReportPDF(userID int) ([]byte, error) {
	user, err := js.db.GetUserByID(uint(userID))
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	userPrograms, err := js.db.GetUserProgramInfo(js.queryCtx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user programs: %w", err)
	}

	for i := range userPrograms {
		userPrograms[i].CalculateAttendancePercentage()
	}

	sessionEngagements, err := js.db.GetUserSessionEngagement(userID, -1)
	if err != nil {
		return nil, fmt.Errorf("failed to get user engagements: %w", err)
	}

	resourceCount, err := js.db.GetUserOpenContentAccessCount(js.queryCtx.Ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get resource count: %w", err)
	}

	type JasperReportData struct {
		Programs []models.ResidentProgramClassInfo `json:"programs"`
	}
	reportData := JasperReportData{
		Programs: userPrograms,
	}
	jsonData, err := json.Marshal(reportData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal report data: %w", err)
	}

	facilityName := "Unknown"
	if user.Facility != nil {
		facilityName = user.Facility.Name
	}

	params := []jasper.Parameter{
		{Key: "ResidentName", Value: fmt.Sprintf("%s %s", user.NameFirst, user.NameLast)},
		{Key: "ResidentID", Value: user.DocID},
		{Key: "FacilityName", Value: facilityName},
		{Key: "GeneratedDate", Value: time.Now().Format("January 2, 2006")},
		{Key: "DateRange", Value: fmt.Sprintf("%s - present", user.CreatedAt.Format("January 2, 2006"))},
		{Key: "TotalTimeSpent", Value: js.calculateTotalTime(sessionEngagements)},
		{Key: "TotalLogins", Value: js.calculateTotalLogins(user)},
		{Key: "TotalResourcesAccessed", Value: fmt.Sprintf("%d", resourceCount.TotalResourcesAccessed)},
		{Key: "HasProgramAccess", Value: fmt.Sprintf("%t", js.hasProgramAccess)},
		{Key: "LogoImage", Value: base64.StdEncoding.EncodeToString(src.UnlockedLogoImg)},
		{Key: "ProgramsCount", Value: fmt.Sprintf("%d", len(userPrograms))},
	}

	tempDir := os.Getenv("JASPER_TEMP_DIR")
	if tempDir == "" {
		tempDir = filepath.Join(os.TempDir(), "jasper-reports")
		if err := os.MkdirAll(tempDir, 0755); err != nil {
			return nil, fmt.Errorf("failed to create temp directory: %w", err)
		}
		logrus.WithField("temp_dir", tempDir).Info("JASPER_TEMP_DIR not set, using fallback directory")
	}
	outputFileName := fmt.Sprintf("user_usage_report_%s", uuid.New().String())
	outputFilePath := filepath.Join(tempDir, outputFileName)
	jsonFileName := fmt.Sprintf("jasper_report_%s.json", uuid.New().String())
	jsonFilePath := filepath.Join(tempDir, jsonFileName)

	logrus.WithFields(logrus.Fields{
		"user_id":          userID,
		"output_file_path": outputFilePath,
		"json_data_length": len(jsonData),
		"json_file_path":   jsonFilePath,
	}).Info("Creating temporary JSON file for Jasper Reports")

	if err := os.WriteFile(jsonFilePath, jsonData, 0600); err != nil {
		return nil, fmt.Errorf("failed to write temporary data file: %w", err)
	}

	defer func() {
		if err := os.Remove(jsonFilePath); err != nil {
			logrus.WithFields(logrus.Fields{
				"json_file": jsonFilePath,
				"error":     err,
			}).Warn("Failed to remove temporary JSON file")
		}

		if err := os.Remove(outputFilePath + ".pdf"); err != nil {
			logrus.WithFields(logrus.Fields{
				"pdf_file": outputFilePath + ".pdf",
				"error":    err,
			}).Warn("Failed to remove temporary PDF file")
		}
	}()

	gj := jasper.NewGoJasperJsonData(jsonFilePath, "", params, "pdf", outputFilePath)
	gj.Output = outputFilePath

	if path, err := exec.LookPath("jasperstarter"); err == nil {
		gj.Executable = path
	} else {
		logrus.Info("jasperstarter not found in PATH, falling back to default path")
		gj.Executable = "/opt/jasperstarter/bin/jasperstarter"
	}

	templateDir := os.Getenv("JASPER_TEMPLATE_DIR")
	if templateDir == "" {
		templateDir = "/templates"
	}
	compiledTemplatePath := filepath.Join(templateDir, "user_usage_report.jasper")
	//TODO keep this here for now, we will figure out how to compile reports during build time
	// template := "/app/backend/src/templates/user_usage_report.jrxml"
	// if err := gj.Compile(template); err != nil {
	// }

	pdfBytes, err := gj.Process(compiledTemplatePath)
	if err != nil {
		logrus.WithFields(logrus.Fields{
			"template_path": compiledTemplatePath,
			"error":         err,
		}).Error("Failed to process compiled template")

		return nil, err
	}

	logrus.WithFields(logrus.Fields{
		"user_id":    userID,
		"pdf_length": len(pdfBytes),
	}).Info("Successfully generated Jasper PDF report")

	return pdfBytes, nil
}

func (js *jasperService) calculateTotalTime(engagements []models.SessionEngagement) string {
	if len(engagements) == 0 {
		return "none"
	}
	return fmt.Sprintf("%.0f minutes", engagements[0].TotalMinutes)
}

func (js *jasperService) calculateTotalLogins(user *models.User) string {
	if user.LoginMetrics == nil {
		return "0"
	}
	return fmt.Sprintf("%d", user.LoginMetrics.Total)
}

func GenerateUsageReportPDF(db *database.DB, queryCtx *models.QueryContext, hasProgramAccess bool, userID int) ([]byte, error) {
	service := newJasperServiceWithContext(db, queryCtx, hasProgramAccess)
	return service.generateUsageReportPDF(userID)
}

// calculateOptimalColumnWidthsInPoints replicates the fpdf calculateOptimalColumnWidths algorithm
// but works directly in points instead of mm
// Converts MinWidths from mm to points, samples data, and scales proportionally if needed
func calculateOptimalColumnWidthsInPoints(headers []string, data [][]string, minWidthsMm []float64, maxWidthMm float64) []float64 {
	if len(headers) == 0 {
		return []float64{}
	}

	// Convert mm to points (1mm ≈ 2.83465 points)
	mmToPoints := 2.83465
	colWidths := make([]float64, len(headers))
	maxWidthPoints := maxWidthMm * mmToPoints

	// Start with MinWidths converted to points
	for i, widthMm := range minWidthsMm {
		if i < len(colWidths) {
			colWidths[i] = widthMm * mmToPoints
		}
	}

	// Sample data to calculate content-based widths
	// Arial 7pt approximate: average char width ~3.5 points, but varies
	// Use a conservative estimate: ~4 points per character for Arial 7pt
	avgCharWidthPoints := 4.0
	sampleSize := 100
	if sampleSize > len(data) {
		sampleSize = len(data)
	}

	for i := 0; i < sampleSize; i++ {
		for j, cell := range data[i] {
			if j < len(colWidths) {
				// Estimate content width: character count * average width + padding
				contentWidth := float64(len(cell)) * avgCharWidthPoints
				if contentWidth > colWidths[j] {
					colWidths[j] = contentWidth
				}
			}
		}
	}

	// Also check header widths
	for i, header := range headers {
		if i < len(colWidths) {
			// Headers use 8pt font, slightly wider: ~4.5 points per character
			headerWidth := float64(len(header)) * 4.5
			if headerWidth > colWidths[i] {
				colWidths[i] = headerWidth
			}
		}
	}

	// Calculate total width
	totalWidth := 0.0
	for _, width := range colWidths {
		totalWidth += width
	}

	// Scale proportionally if total exceeds maxWidth
	if totalWidth > maxWidthPoints {
		scale := maxWidthPoints / totalWidth
		for i := range colWidths {
			colWidths[i] *= scale
		}
	}

	return colWidths
}

// GenerateGenericReportPDF generates a PDF report using the generic Jasper template
// This is a basic implementation for Phase 2 testing with hardcoded test data
func GenerateGenericReportPDF(config models.PDFConfig, filterSummary []models.PDFFilterLine) ([]byte, error) {
	// Create generic report data structure
	type GenericReportData struct {
		Rows [][]string `json:"rows"`
	}

	// Use actual data from config
	rows := config.Data
	if len(rows) == 0 {
		// Empty report - create empty rows array
		rows = [][]string{}
	}

	reportData := GenericReportData{
		Rows: rows,
	}

	jsonData, err := json.Marshal(reportData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal report data: %w", err)
	}

	// Build basic parameters
	title := config.Title
	if title == "" {
		title = "Test Report"
	}

	// Calculate optimal column widths in points (replicating fpdf algorithm)
	// Max width: 280mm ≈ 794 points
	maxWidthMm := 280.0
	widthsInPoints := calculateOptimalColumnWidthsInPoints(config.Headers, config.Data, config.MinWidths, maxWidthMm)
	widthsJSON, _ := json.Marshal(widthsInPoints)
	if len(widthsInPoints) == 0 {
		widthsJSON = []byte("[]")
	}

	// Convert alignments to JSON array
	alignmentsJSON, _ := json.Marshal(config.Alignments)
	if len(config.Alignments) == 0 {
		alignmentsJSON = []byte("[]")
	}

	params := []jasper.Parameter{
		{Key: "ReportTitle", Value: title},
		{Key: "GeneratedDate", Value: time.Now().Format("January 2, 2006 at 3:04 PM")},
		{Key: "LogoImage", Value: base64.StdEncoding.EncodeToString(src.UnlockedLogoImg)},
		{Key: "ColumnWidths", Value: string(widthsJSON)},
		{Key: "ColumnAlignments", Value: string(alignmentsJSON)},
		{Key: "FilterSummary", Value: ""},
	}

	// Add individual column header parameters (simpler than JSON array for Jasper)
	for i, header := range config.Headers {
		if i < 15 {
			params = append(params, jasper.Parameter{Key: fmt.Sprintf("ColumnHeader%d", i), Value: header})
		}
	}

	// Fill missing headers with empty strings
	for i := len(config.Headers); i < 15; i++ {
		params = append(params, jasper.Parameter{Key: fmt.Sprintf("ColumnHeader%d", i), Value: ""})
	}

	// Format filter summary as a readable string
	filterSummaryText := ""
	if len(filterSummary) > 0 {
		var filterLines []string
		for _, filter := range filterSummary {
			filterLines = append(filterLines, fmt.Sprintf("%s: %s", filter.Label, filter.Value))
		}
		filterSummaryText = "Report Filters:\n" + strings.Join(filterLines, "\n")
	}
	params[5].Value = filterSummaryText

	tempDir := os.Getenv("JASPER_TEMP_DIR")
	if tempDir == "" {
		tempDir = filepath.Join(os.TempDir(), "jasper-reports")
		if err := os.MkdirAll(tempDir, 0755); err != nil {
			return nil, fmt.Errorf("failed to create temp directory: %w", err)
		}
		logrus.WithField("temp_dir", tempDir).Info("JASPER_TEMP_DIR not set, using fallback directory")
	}

	outputFileName := fmt.Sprintf("generic_report_%s", uuid.New().String())
	outputFilePath := filepath.Join(tempDir, outputFileName)
	jsonFileName := fmt.Sprintf("generic_report_%s.json", uuid.New().String())
	jsonFilePath := filepath.Join(tempDir, jsonFileName)

	logrus.WithFields(logrus.Fields{
		"output_file_path": outputFilePath,
		"json_data_length": len(jsonData),
		"json_file_path":   jsonFilePath,
		"row_count":        len(rows),
	}).Info("Creating temporary JSON file for generic Jasper report")

	if err := os.WriteFile(jsonFilePath, jsonData, 0600); err != nil {
		return nil, fmt.Errorf("failed to write temporary data file: %w", err)
	}

	defer func() {
		if err := os.Remove(jsonFilePath); err != nil {
			logrus.WithFields(logrus.Fields{
				"json_file": jsonFilePath,
				"error":     err,
			}).Warn("Failed to remove temporary JSON file")
		}

		if err := os.Remove(outputFilePath + ".pdf"); err != nil {
			logrus.WithFields(logrus.Fields{
				"pdf_file": outputFilePath + ".pdf",
				"error":    err,
			}).Warn("Failed to remove temporary PDF file")
		}
	}()

	gj := jasper.NewGoJasperJsonData(jsonFilePath, "", params, "pdf", outputFilePath)
	gj.Output = outputFilePath

	if path, err := exec.LookPath("jasperstarter"); err == nil {
		gj.Executable = path
	} else {
		logrus.Info("jasperstarter not found in PATH, falling back to default path")
		gj.Executable = "/opt/jasperstarter/bin/jasperstarter"
	}

	templateDir := os.Getenv("JASPER_TEMPLATE_DIR")
	if templateDir == "" {
		templateDir = "/templates"
	}
	compiledTemplatePath := filepath.Join(templateDir, "generic_report.jasper")

	pdfBytes, err := gj.Process(compiledTemplatePath)
	if err != nil {
		logrus.WithFields(logrus.Fields{
			"template_path": compiledTemplatePath,
			"error":         err,
		}).Error("Failed to process compiled generic template")

		return nil, fmt.Errorf("failed to process template: %w", err)
	}

	logrus.WithFields(logrus.Fields{
		"pdf_length": len(pdfBytes),
		"row_count":  len(rows),
	}).Info("Successfully generated generic Jasper PDF report")

	return pdfBytes, nil
}
