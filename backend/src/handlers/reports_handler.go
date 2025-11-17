package handlers

import (
	"UnlockEdv2/src/models"
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/go-pdf/fpdf"
	"github.com/sirupsen/logrus"
	"github.com/xuri/excelize/v2"
)

const (
	pdfMaxWidth         = 280.0
	pdfSampleSize       = 100
	maxDateRangeDays    = 90
	maxFacilitiesInList = 50
)

func calculateOptimalColumnWidths(config *ColumnWidthConfig) []float64 {
	colWidths := make([]float64, len(config.Headers))
	copy(colWidths, config.MinWidths)

	sampleSize := config.SampleSize
	if sampleSize > len(config.Data) {
		sampleSize = len(config.Data)
	}

	for i := 0; i < sampleSize; i++ {
		for j, cell := range config.Data[i] {
			if j < len(colWidths) {
				contentWidth := config.PDF.GetStringWidth(cell) + 4
				if contentWidth > colWidths[j] {
					colWidths[j] = contentWidth
				}
			}
		}
	}

	totalWidth := 0.0
	for _, width := range colWidths {
		totalWidth += width
	}

	if totalWidth > config.MaxWidth {
		scale := config.MaxWidth / totalWidth
		for i := range colWidths {
			colWidths[i] *= scale
		}
	}

	return colWidths
}

func renderPDFTable(config *PDFTableConfig) {
	config.PDF.SetFont("Arial", "B", config.HeaderFontSize)
	for i, header := range config.Headers {
		config.PDF.CellFormat(config.ColumnWidths[i], 7, header, "1", 0, "C", false, 0, "")
	}
	config.PDF.Ln(-1)

	config.PDF.SetFont("Arial", "", config.DataFontSize)
	for _, row := range config.Data {
		for i, cell := range row {
			if i < len(config.ColumnWidths) {
				alignment := "L"
				if i < len(config.Alignments) {
					alignment = config.Alignments[i]
				}
				config.PDF.CellFormat(config.ColumnWidths[i], 6, cell, "1", 0, alignment, false, 0, "")
			}
		}
		config.PDF.Ln(-1)
	}
}

func isValidReportType(rt models.ReportType) bool {
	switch rt {
	case models.AttendanceReport, models.ProgramOutcomesReport, models.FacilityComparisonReport:
		return true
	default:
		return false
	}
}

func isValidReportFormat(format models.ReportFormat) bool {
	switch format {
	case models.FormatCSV, models.FormatPDF, models.FormatExcel:
		return true
	default:
		return false
	}
}

func (srv *Server) registerReportsRoutes() []routeDef {
	axx := models.ProgramAccess
	return []routeDef{
		{
			routeMethod: "POST /api/reports/generate",
			handler:     srv.handleGenerateReport,
			admin:       true,
			features:    []models.FeatureAccess{axx},
			resolver:    nil,
		},
	}
}

func (srv *Server) handleGenerateReport(w http.ResponseWriter, r *http.Request, log sLog) error {
	claims := r.Context().Value(ClaimsKey).(*Claims)

	var req models.ReportGenerateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return newJSONReqBodyServiceError(err)
	}

	if !isValidReportType(req.Type) {
		return newBadRequestServiceError(errors.New("invalid report type"),
			"invalid report type specified")
	}

	if !isValidReportFormat(req.Format) {
		return newBadRequestServiceError(errors.New("invalid format"),
			"invalid export format specified")
	}

	if req.StartDate.After(req.EndDate) {
		return newBadRequestServiceError(errors.New("invalid date range"),
			"start_date cannot be after end_date")
	}

	maxDateRange := req.EndDate.Sub(req.StartDate)
	if maxDateRange > maxDateRangeDays*24*time.Hour {
		return newBadRequestServiceError(errors.New("date range too large"),
			"date range cannot exceed 90 days")
	}

	if claims.Role == models.FacilityAdmin {
		facilityID := claims.FacilityID
		req.FacilityID = &facilityID
	}

	if req.Type == models.FacilityComparisonReport {
		if !claims.canSwitchFacility() {
			return newForbiddenServiceError(errors.New("role insufficient"),
				"facility comparison reports require DepartmentAdmin or SystemAdmin role")
		}
		if len(req.FacilityIDs) == 0 {
			return newBadRequestServiceError(errors.New("missing facility_ids"),
				"facility_ids array is required for comparison reports")
		}
		if len(req.FacilityIDs) > maxFacilitiesInList {
			return newBadRequestServiceError(errors.New("too many facilities"),
				fmt.Sprintf("cannot compare more than %d facilities", maxFacilitiesInList))
		}
	}

	switch req.Type {
	case models.AttendanceReport:
		return srv.handleAttendanceReport(w, r, &req, claims)
	case models.ProgramOutcomesReport:
		return srv.handleProgramOutcomesReport(w, r, &req, claims)
	case models.FacilityComparisonReport:
		return srv.handleFacilityComparisonReport(w, r, &req, claims)
	default:
		return newBadRequestServiceError(errors.New("invalid report type"),
			"invalid report type specified")
	}
}

type PDFTableConfig struct {
	PDF            *fpdf.Fpdf
	Headers        []string
	ColumnWidths   []float64
	Alignments     []string
	Data           [][]string
	HeaderFontSize float64
	DataFontSize   float64
}

type ColumnWidthConfig struct {
	PDF        *fpdf.Fpdf
	Headers    []string
	Data       [][]string
	MinWidths  []float64
	MaxWidth   float64
	SampleSize int
}

type reportExporter interface {
	ToCSV() ([][]string, error)
	ToExcel() (*excelize.File, error)
	ToPDF() (models.PDFConfig, error)
	Len() int
}

func (srv *Server) handleAttendanceReport(w http.ResponseWriter, r *http.Request, req *models.ReportGenerateRequest, claims *Claims) error {
	startTime := time.Now()

	ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()

	rows, err := srv.Db.GenerateAttendanceReport(ctx, req)
	if err != nil {
		srv.logReportFailure(claims.UserID, "attendance", req, startTime, 0)
		return newDatabaseServiceError(err)
	}

	report := models.AttendanceReportData{Data: rows}

	if err := srv.exportReport(w, report, req.Format); err != nil {
		srv.logReportFailure(claims.UserID, "attendance", req, startTime, report.Len())
		return err
	}

	srv.logReportSuccess(claims.UserID, "attendance", req, startTime, report.Len(), claims.FacilityID, 1)
	return nil
}

func (srv *Server) handleProgramOutcomesReport(w http.ResponseWriter, r *http.Request, req *models.ReportGenerateRequest, claims *Claims) error {
	startTime := time.Now()

	ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()

	rows, err := srv.Db.GenerateProgramOutcomesReport(ctx, req)
	if err != nil {
		srv.logReportFailure(claims.UserID, "program_outcomes", req, startTime, 0)
		return newDatabaseServiceError(err)
	}

	report := models.ProgramOutcomesReportData{Data: rows}

	if err := srv.exportReport(w, report, req.Format); err != nil {
		srv.logReportFailure(claims.UserID, "program_outcomes", req, startTime, report.Len())
		return err
	}

	srv.logReportSuccess(claims.UserID, "program_outcomes", req, startTime, report.Len(), claims.FacilityID, 1)
	return nil
}

func (srv *Server) handleFacilityComparisonReport(w http.ResponseWriter, r *http.Request, req *models.ReportGenerateRequest, claims *Claims) error {
	startTime := time.Now()

	ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()

	rows, err := srv.Db.GenerateFacilityComparisonReport(ctx, req, req.FacilityIDs)
	if err != nil {
		srv.logReportFailure(claims.UserID, "facility_comparison", req, startTime, 0)
		return newDatabaseServiceError(err)
	}

	report := models.FacilityComparisonReportData{Data: rows}

	if err := srv.exportReport(w, report, req.Format); err != nil {
		srv.logReportFailure(claims.UserID, "facility_comparison", req, startTime, report.Len())
		return err
	}

	srv.logReportSuccess(claims.UserID, "facility_comparison", req, startTime, report.Len(), 0, len(req.FacilityIDs))
	return nil
}

func (srv *Server) exportReport(w http.ResponseWriter, report reportExporter, format models.ReportFormat) error {
	switch format {
	case models.FormatCSV:
		csvData, err := report.ToCSV()
		if err != nil {
			return newInternalServerServiceError(err, "failed to format CSV")
		}

		pdfConfig, err := report.ToPDF()
		if err != nil {
			return newInternalServerServiceError(err, "failed to generate PDF config")
		}
		filename := fmt.Sprintf("%s-Report-%s.csv", pdfConfig.Title, time.Now().Format("2006-01-02"))
		w.Header().Set("Content-Type", "text/csv")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
		w.WriteHeader(http.StatusOK)

		writer := csv.NewWriter(w)
		if err := writer.WriteAll(csvData); err != nil {
			return newInternalServerServiceError(err, "failed to write CSV")
		}
		return nil

	case models.FormatExcel:
		f, err := report.ToExcel()
		if err != nil {
			return newInternalServerServiceError(err, "failed to create Excel file")
		}

		pdfConfig, err := report.ToPDF()
		if err != nil {
			return newInternalServerServiceError(err, "failed to generate PDF config")
		}
		filename := fmt.Sprintf("%s-Report-%s.xlsx", pdfConfig.Title, time.Now().Format("2006-01-02"))
		w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
		w.WriteHeader(http.StatusOK)

		if err := f.Write(w); err != nil {
			return newInternalServerServiceError(err, "failed to write Excel file")
		}
		return nil

	case models.FormatPDF:
		config, err := report.ToPDF()
		if err != nil {
			return newInternalServerServiceError(err, "failed to generate PDF config")
		}

		pdf := fpdf.New("L", "mm", "A4", "")
		pdf.AddPage()
		pdf.SetFont("Arial", "", config.DataFontSize)

		colWidths := calculateOptimalColumnWidths(&ColumnWidthConfig{
			PDF:        pdf,
			Headers:    config.Headers,
			Data:       config.Data,
			MinWidths:  config.MinWidths,
			MaxWidth:   pdfMaxWidth,
			SampleSize: pdfSampleSize,
		})

		renderPDFTable(&PDFTableConfig{
			PDF:            pdf,
			Headers:        config.Headers,
			ColumnWidths:   colWidths,
			Alignments:     config.Alignments,
			Data:           config.Data,
			HeaderFontSize: config.HeaderFontSize,
			DataFontSize:   config.DataFontSize,
		})

		filename := fmt.Sprintf("%s-Report-%s.pdf", config.Title, time.Now().Format("2006-01-02"))
		w.Header().Set("Content-Type", "application/pdf")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
		w.WriteHeader(http.StatusOK)

		if err := pdf.Output(w); err != nil {
			return newInternalServerServiceError(err, "failed to generate PDF")
		}
		return nil

	default:
		return newBadRequestServiceError(errors.New("invalid format"), "invalid export format")
	}
}

func (srv *Server) logReportSuccess(userID uint, reportType string, req *models.ReportGenerateRequest, startTime time.Time, rowCount int, facilityID uint, facilityCount int) {
	dateRangeDays := int(req.EndDate.Sub(req.StartDate).Hours() / 24)

	fields := logrus.Fields{
		"audit":              "report_generation",
		"user_id":            userID,
		"report_type":        reportType,
		"facility_id":        facilityID,
		"format":             string(req.Format),
		"success":            true,
		"row_count":          rowCount,
		"processing_time_ms": time.Since(startTime).Milliseconds(),
		"date_range_days":    dateRangeDays,
		"facility_count":     facilityCount,
		"timestamp":          time.Now(),
	}

	if reportType == "facility_comparison" && facilityCount > 1 {
		fields["data_scope"] = "multi_facility"
	} else if facilityCount == 1 {
		fields["data_scope"] = "single_facility"
	}

	logrus.WithFields(fields).Info("Report generated")
}

func (srv *Server) logReportFailure(userID uint, reportType string, req *models.ReportGenerateRequest, startTime time.Time, rowCount int) {
	dateRangeDays := int(req.EndDate.Sub(req.StartDate).Hours() / 24)

	fields := logrus.Fields{
		"audit":              "report_generation",
		"user_id":            userID,
		"report_type":        reportType,
		"format":             string(req.Format),
		"success":            false,
		"row_count":          rowCount,
		"processing_time_ms": time.Since(startTime).Milliseconds(),
		"date_range_days":    dateRangeDays,
		"timestamp":          time.Now(),
	}

	logrus.WithFields(fields).Error("Report generation failed")
}
