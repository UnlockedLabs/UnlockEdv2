package models

import (
	"fmt"
	"strconv"
	"time"

	"github.com/xuri/excelize/v2"
)

type ReportType string

const (
	AttendanceReport         ReportType = "attendance"
	ProgramOutcomesReport    ReportType = "program_outcomes"
	FacilityComparisonReport ReportType = "facility_comparison"
)

type ReportFormat string

const (
	FormatCSV   ReportFormat = "csv"
	FormatPDF   ReportFormat = "pdf"
	FormatExcel ReportFormat = "excel"
)

type ReportGenerateRequest struct {
	Type      ReportType   `json:"type" validate:"required,oneof=attendance program_outcomes facility_comparison"`
	Format    ReportFormat `json:"format" validate:"required,oneof=csv pdf excel"`
	StartDate time.Time    `json:"start_date" validate:"required"`
	EndDate   time.Time    `json:"end_date" validate:"required,gtefield=StartDate"`

	FacilityID   *uint         `json:"facility_id"`
	FacilityIDs  []uint        `json:"facility_ids" validate:"min=1,dive,min=1"`
	ProgramID    *uint         `json:"program_id"`
	ClassID      *uint         `json:"class_id"`
	UserID       *uint         `json:"user_id"`
	ClassStatus  *string       `json:"class_status"`
	ProgramTypes []ProgType    `json:"program_types"`
	FundingTypes []FundingType `json:"funding_types"`
}

type PDFConfig struct {
	Title          string
	Headers        []string
	Data           [][]string
	MinWidths      []float64
	Alignments     []string
	HeaderFontSize float64
	DataFontSize   float64
}

type AttendanceReportRow struct {
	FacilityName     string
	ProgramName      string
	ClassName        string
	Date             time.Time
	StudentLastName  string
	StudentFirstName string
	DocID            string
	AttendanceStatus Attendance
	SeatTimeMinutes  *int
	AbsenceReason    *string
}

type ProgramOutcomesReportRow struct {
	FacilityName         string
	ProgramName          string
	ProgramType          string
	FundingType          string
	TotalEnrollments     int
	ActiveEnrollments    int
	CompletedEnrollments int
	DroppedEnrollments   int
	CompletionRate       float64
	AttendanceRate       float64
	TotalCreditHours     float64
	CertificatesEarned   int
}

type FacilityComparisonReportRow struct {
	FacilityName       string
	TotalPrograms      int
	ActivePrograms     int
	TotalEnrollments   int
	ActiveEnrollments  int
	CompletionRate     float64
	AttendanceRate     float64
	TopProgramType     string
	TotalCreditHours   float64
	CertificatesEarned int
	LastActivityDate   *time.Time
}

type AttendanceReportData struct {
	Data []AttendanceReportRow
}

type ProgramOutcomesReportData struct {
	Data []ProgramOutcomesReportRow
}

type FacilityComparisonReportData struct {
	Data []FacilityComparisonReportRow
}

func (r AttendanceReportData) Len() int {
	return len(r.Data)
}

func (r AttendanceReportData) ToCSV() ([][]string, error) {
	csvData := [][]string{
		{"Facility", "Program", "Class", "Date", "Last Name", "First Name", "DOC ID", "Status", "Seat Time (min)", "Absence Reason"},
	}

	for _, row := range r.Data {
		csvData = append(csvData, []string{
			row.FacilityName,
			row.ProgramName,
			row.ClassName,
			row.Date.Format("2006-01-02"),
			row.StudentLastName,
			row.StudentFirstName,
			row.DocID,
			string(row.AttendanceStatus),
			FormatNullableInt(row.SeatTimeMinutes),
			FormatNullableString(row.AbsenceReason),
		})
	}

	return csvData, nil
}

func (r ProgramOutcomesReportData) Len() int {
	return len(r.Data)
}

func (r ProgramOutcomesReportData) ToCSV() ([][]string, error) {
	csvData := [][]string{
		{"Facility", "Program", "Program Type", "Funding Type", "Total Enrollments", "Active", "Completed", "Dropped", "Completion Rate (%)", "Attendance Rate (%)", "Total Credit Hours", "Certificates Earned"},
	}

	for _, row := range r.Data {
		csvData = append(csvData, []string{
			row.FacilityName,
			row.ProgramName,
			row.ProgramType,
			row.FundingType,
			strconv.Itoa(row.TotalEnrollments),
			strconv.Itoa(row.ActiveEnrollments),
			strconv.Itoa(row.CompletedEnrollments),
			strconv.Itoa(row.DroppedEnrollments),
			strconv.FormatFloat(row.CompletionRate, 'f', 2, 64),
			strconv.FormatFloat(row.AttendanceRate, 'f', 2, 64),
			strconv.FormatFloat(row.TotalCreditHours, 'f', 2, 64),
			strconv.Itoa(row.CertificatesEarned),
		})
	}

	return csvData, nil
}

func (r FacilityComparisonReportData) Len() int {
	return len(r.Data)
}

func (r FacilityComparisonReportData) ToCSV() ([][]string, error) {
	csvData := [][]string{
		{"Facility", "Total Programs", "Active Programs", "Total Enrollments", "Active Enrollments", "Completion Rate (%)", "Attendance Rate (%)", "Top Program Type", "Total Credit Hours", "Certificates Earned", "Last Activity Date"},
	}

	for _, row := range r.Data {
		lastActivity := ""
		if row.LastActivityDate != nil {
			lastActivity = row.LastActivityDate.Format("2006-01-02")
		}

		csvData = append(csvData, []string{
			row.FacilityName,
			strconv.Itoa(row.TotalPrograms),
			strconv.Itoa(row.ActivePrograms),
			strconv.Itoa(row.TotalEnrollments),
			strconv.Itoa(row.ActiveEnrollments),
			strconv.FormatFloat(row.CompletionRate, 'f', 2, 64),
			strconv.FormatFloat(row.AttendanceRate, 'f', 2, 64),
			row.TopProgramType,
			strconv.FormatFloat(row.TotalCreditHours, 'f', 2, 64),
			strconv.Itoa(row.CertificatesEarned),
			lastActivity,
		})
	}

	return csvData, nil
}

//nolint:errcheck // Excel cell setting errors are unlikely and checked at sheet creation
func (r AttendanceReportData) ToExcel() (*excelize.File, error) {
	f := excelize.NewFile()
	sheetName := "Attendance Report"
	index, err := f.NewSheet(sheetName)
	if err != nil {
		return nil, fmt.Errorf("failed to create Excel sheet: %w", err)
	}
	f.SetActiveSheet(index)

	headers := []string{"Facility", "Program", "Class", "Date", "Last Name", "First Name", "DOC ID", "Status", "Seat Time (min)", "Absence Reason"}
	for i, header := range headers {
		cell := fmt.Sprintf("%s1", excelColumnName(i))
		f.SetCellValue(sheetName, cell, header)
	}

	for i, row := range r.Data {
		rowNum := i + 2
		f.SetCellValue(sheetName, fmt.Sprintf("A%d", rowNum), row.FacilityName)
		f.SetCellValue(sheetName, fmt.Sprintf("B%d", rowNum), row.ProgramName)
		f.SetCellValue(sheetName, fmt.Sprintf("C%d", rowNum), row.ClassName)
		f.SetCellValue(sheetName, fmt.Sprintf("D%d", rowNum), row.Date.Format("2006-01-02"))
		f.SetCellValue(sheetName, fmt.Sprintf("E%d", rowNum), row.StudentLastName)
		f.SetCellValue(sheetName, fmt.Sprintf("F%d", rowNum), row.StudentFirstName)
		f.SetCellValue(sheetName, fmt.Sprintf("G%d", rowNum), row.DocID)
		f.SetCellValue(sheetName, fmt.Sprintf("H%d", rowNum), string(row.AttendanceStatus))
		f.SetCellValue(sheetName, fmt.Sprintf("I%d", rowNum), FormatNullableInt(row.SeatTimeMinutes))
		f.SetCellValue(sheetName, fmt.Sprintf("J%d", rowNum), FormatNullableString(row.AbsenceReason))
	}

	return f, nil
}

//nolint:errcheck // Excel cell setting errors are unlikely and checked at sheet creation
func (r ProgramOutcomesReportData) ToExcel() (*excelize.File, error) {
	f := excelize.NewFile()
	sheetName := "Program Outcomes"
	index, err := f.NewSheet(sheetName)
	if err != nil {
		return nil, fmt.Errorf("failed to create Excel sheet: %w", err)
	}
	f.SetActiveSheet(index)

	headers := []string{"Facility", "Program", "Program Type", "Funding Type", "Total Enrollments", "Active", "Completed", "Dropped", "Completion Rate (%)", "Attendance Rate (%)", "Total Credit Hours", "Certificates Earned"}
	for i, header := range headers {
		cell := fmt.Sprintf("%s1", excelColumnName(i))
		f.SetCellValue(sheetName, cell, header)
	}

	for i, row := range r.Data {
		rowNum := i + 2
		f.SetCellValue(sheetName, fmt.Sprintf("A%d", rowNum), row.FacilityName)
		f.SetCellValue(sheetName, fmt.Sprintf("B%d", rowNum), row.ProgramName)
		f.SetCellValue(sheetName, fmt.Sprintf("C%d", rowNum), row.ProgramType)
		f.SetCellValue(sheetName, fmt.Sprintf("D%d", rowNum), row.FundingType)
		f.SetCellValue(sheetName, fmt.Sprintf("E%d", rowNum), row.TotalEnrollments)
		f.SetCellValue(sheetName, fmt.Sprintf("F%d", rowNum), row.ActiveEnrollments)
		f.SetCellValue(sheetName, fmt.Sprintf("G%d", rowNum), row.CompletedEnrollments)
		f.SetCellValue(sheetName, fmt.Sprintf("H%d", rowNum), row.DroppedEnrollments)
		f.SetCellValue(sheetName, fmt.Sprintf("I%d", rowNum), fmt.Sprintf("%.2f", row.CompletionRate))
		f.SetCellValue(sheetName, fmt.Sprintf("J%d", rowNum), fmt.Sprintf("%.2f", row.AttendanceRate))
		f.SetCellValue(sheetName, fmt.Sprintf("K%d", rowNum), fmt.Sprintf("%.2f", row.TotalCreditHours))
		f.SetCellValue(sheetName, fmt.Sprintf("L%d", rowNum), row.CertificatesEarned)
	}

	return f, nil
}

//nolint:errcheck // Excel cell setting errors are unlikely and checked at sheet creation
func (r FacilityComparisonReportData) ToExcel() (*excelize.File, error) {
	f := excelize.NewFile()
	sheetName := "Facility Comparison"
	index, err := f.NewSheet(sheetName)
	if err != nil {
		return nil, fmt.Errorf("failed to create Excel sheet: %w", err)
	}
	f.SetActiveSheet(index)

	headers := []string{"Facility", "Total Programs", "Active Programs", "Total Enrollments", "Active Enrollments", "Completion Rate (%)", "Attendance Rate (%)", "Top Program Type", "Total Credit Hours", "Certificates Earned", "Last Activity Date"}
	for i, header := range headers {
		cell := fmt.Sprintf("%s1", excelColumnName(i))
		f.SetCellValue(sheetName, cell, header)
	}

	for i, row := range r.Data {
		rowNum := i + 2
		lastActivity := ""
		if row.LastActivityDate != nil {
			lastActivity = row.LastActivityDate.Format("2006-01-02")
		}

		f.SetCellValue(sheetName, fmt.Sprintf("A%d", rowNum), row.FacilityName)
		f.SetCellValue(sheetName, fmt.Sprintf("B%d", rowNum), row.TotalPrograms)
		f.SetCellValue(sheetName, fmt.Sprintf("C%d", rowNum), row.ActivePrograms)
		f.SetCellValue(sheetName, fmt.Sprintf("D%d", rowNum), row.TotalEnrollments)
		f.SetCellValue(sheetName, fmt.Sprintf("E%d", rowNum), row.ActiveEnrollments)
		f.SetCellValue(sheetName, fmt.Sprintf("F%d", rowNum), fmt.Sprintf("%.2f", row.CompletionRate))
		f.SetCellValue(sheetName, fmt.Sprintf("G%d", rowNum), fmt.Sprintf("%.2f", row.AttendanceRate))
		f.SetCellValue(sheetName, fmt.Sprintf("H%d", rowNum), row.TopProgramType)
		f.SetCellValue(sheetName, fmt.Sprintf("I%d", rowNum), fmt.Sprintf("%.2f", row.TotalCreditHours))
		f.SetCellValue(sheetName, fmt.Sprintf("J%d", rowNum), row.CertificatesEarned)
		f.SetCellValue(sheetName, fmt.Sprintf("K%d", rowNum), lastActivity)
	}

	return f, nil
}

func (r AttendanceReportData) ToPDF() (PDFConfig, error) {
	tableData := make([][]string, len(r.Data))
	for i, row := range r.Data {
		tableData[i] = []string{
			row.FacilityName,
			row.ProgramName,
			row.ClassName,
			row.Date.Format("2006-01-02"),
			row.StudentLastName,
			row.StudentFirstName,
			row.DocID,
			string(row.AttendanceStatus),
			FormatNullableInt(row.SeatTimeMinutes),
			FormatNullableString(row.AbsenceReason),
		}
	}

	return PDFConfig{
		Title:          "Attendance",
		Headers:        []string{"Facility", "Program", "Class", "Date", "Last Name", "First Name", "DOC ID", "Status", "Seat Time (min)", "Absence Reason"},
		Data:           tableData,
		MinWidths:      []float64{20, 30, 25, 20, 25, 25, 15, 25, 15, 30},
		Alignments:     []string{"L", "L", "L", "C", "L", "L", "C", "C", "C", "L"},
		HeaderFontSize: 10,
		DataFontSize:   9,
	}, nil
}

func (r ProgramOutcomesReportData) ToPDF() (PDFConfig, error) {
	tableData := make([][]string, len(r.Data))
	for i, row := range r.Data {
		tableData[i] = []string{
			row.FacilityName,
			row.ProgramName,
			row.ProgramType,
			row.FundingType,
			fmt.Sprintf("%d", row.TotalEnrollments),
			fmt.Sprintf("%d", row.ActiveEnrollments),
			fmt.Sprintf("%d", row.CompletedEnrollments),
			fmt.Sprintf("%d", row.DroppedEnrollments),
			fmt.Sprintf("%.1f", row.CompletionRate),
			fmt.Sprintf("%.1f", row.AttendanceRate),
			fmt.Sprintf("%.1f", row.TotalCreditHours),
			fmt.Sprintf("%d", row.CertificatesEarned),
		}
	}

	return PDFConfig{
		Title:          "Program-Outcomes",
		Headers:        []string{"Facility", "Program", "Type", "Funding", "Total", "Active", "Completed", "Dropped", "Comp%", "Attend%", "Credit Hours", "Certificates"},
		Data:           tableData,
		MinWidths:      []float64{30, 30, 20, 20, 15, 15, 18, 16, 15, 15, 18, 15},
		Alignments:     []string{},
		HeaderFontSize: 8,
		DataFontSize:   7,
	}, nil
}

func (r FacilityComparisonReportData) ToPDF() (PDFConfig, error) {
	tableData := make([][]string, len(r.Data))
	for i, row := range r.Data {
		lastActivity := ""
		if row.LastActivityDate != nil {
			lastActivity = row.LastActivityDate.Format("2006-01-02")
		}
		tableData[i] = []string{
			row.FacilityName,
			fmt.Sprintf("%d", row.TotalPrograms),
			fmt.Sprintf("%d", row.ActivePrograms),
			fmt.Sprintf("%d", row.TotalEnrollments),
			fmt.Sprintf("%d", row.ActiveEnrollments),
			fmt.Sprintf("%.1f", row.CompletionRate),
			fmt.Sprintf("%.1f", row.AttendanceRate),
			row.TopProgramType,
			fmt.Sprintf("%.1f", row.TotalCreditHours),
			fmt.Sprintf("%d", row.CertificatesEarned),
			lastActivity,
		}
	}

	return PDFConfig{
		Title:          "Facility-Comparison",
		Headers:        []string{"Facility", "Programs", "Active", "Enrollments", "Active", "Comp%", "Attend%", "Top Type", "Credit Hours", "Certificates", "Last Activity"},
		Data:           tableData,
		MinWidths:      []float64{35, 18, 16, 22, 16, 15, 15, 25, 18, 15, 20},
		Alignments:     []string{},
		HeaderFontSize: 8,
		DataFontSize:   7,
	}, nil
}

func FormatNullableInt(val *int) string {
	if val == nil {
		return ""
	}
	return strconv.Itoa(*val)
}

func FormatNullableString(val *string) string {
	if val == nil {
		return ""
	}
	return *val
}

func excelColumnName(col int) string {
	name := ""
	for col >= 0 {
		name = string(rune('A'+(col%26))) + name
		col = col/26 - 1
	}
	return name
}
