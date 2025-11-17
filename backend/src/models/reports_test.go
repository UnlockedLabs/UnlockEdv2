package models

import (
	"testing"
	"time"
)

func TestAttendanceReportToCSV(t *testing.T) {
	seatTime := 90
	absenceReason := "Medical appointment"

	data := []AttendanceReportRow{
		{
			FacilityName:     "Test Facility",
			ProgramName:      "Math 101",
			ClassName:        "Algebra",
			Date:             time.Date(2024, 3, 15, 0, 0, 0, 0, time.UTC),
			StudentLastName:  "Doe",
			StudentFirstName: "John",
			DocID:            "12345",
			AttendanceStatus: Present,
			SeatTimeMinutes:  &seatTime,
			AbsenceReason:    nil,
		},
		{
			FacilityName:     "Test Facility",
			ProgramName:      "Math 101",
			ClassName:        "Algebra",
			Date:             time.Date(2024, 3, 16, 0, 0, 0, 0, time.UTC),
			StudentLastName:  "Smith",
			StudentFirstName: "Jane",
			DocID:            "67890",
			AttendanceStatus: Absent_Excused,
			SeatTimeMinutes:  nil,
			AbsenceReason:    &absenceReason,
		},
	}

	report := AttendanceReportData{Data: data}
	csv, err := report.ToCSV()
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(csv) != 3 {
		t.Fatalf("Expected 3 rows (header + 2 data), got %d", len(csv))
	}

	headerRow := csv[0]
	expectedHeaders := []string{"Facility", "Program", "Class", "Date", "Last Name", "First Name", "DOC ID", "Status", "Seat Time (min)", "Absence Reason"}
	for i, expected := range expectedHeaders {
		if headerRow[i] != expected {
			t.Errorf("Header column %d: expected '%s', got '%s'", i, expected, headerRow[i])
		}
	}

	firstDataRow := csv[1]
	if firstDataRow[0] != "Test Facility" {
		t.Errorf("Expected facility 'Test Facility', got '%s'", firstDataRow[0])
	}
	if firstDataRow[3] != "2024-03-15" {
		t.Errorf("Expected date '2024-03-15', got '%s'", firstDataRow[3])
	}
	if firstDataRow[8] != "90" {
		t.Errorf("Expected seat time '90', got '%s'", firstDataRow[8])
	}
	if firstDataRow[9] != "" {
		t.Errorf("Expected empty absence reason, got '%s'", firstDataRow[9])
	}

	secondDataRow := csv[2]
	if secondDataRow[8] != "" {
		t.Errorf("Expected empty seat time, got '%s'", secondDataRow[8])
	}
	if secondDataRow[9] != "Medical appointment" {
		t.Errorf("Expected absence reason 'Medical appointment', got '%s'", secondDataRow[9])
	}
}

func TestProgramOutcomesReportToCSV(t *testing.T) {
	data := []ProgramOutcomesReportRow{
		{
			FacilityName:         "Test Facility",
			ProgramName:          "Math Program",
			ProgramType:          "Academic",
			FundingType:          "State",
			TotalEnrollments:     100,
			ActiveEnrollments:    60,
			CompletedEnrollments: 30,
			DroppedEnrollments:   10,
			CompletionRate:       30.0,
			AttendanceRate:       65.5,
			TotalCreditHours:     450.0,
			CertificatesEarned:   25,
		},
	}

	report := ProgramOutcomesReportData{Data: data}
	csv, err := report.ToCSV()
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(csv) != 2 {
		t.Fatalf("Expected 2 rows (header + 1 data), got %d", len(csv))
	}

	dataRow := csv[1]
	if dataRow[0] != "Test Facility" {
		t.Errorf("Expected facility 'Test Facility', got '%s'", dataRow[0])
	}
	if dataRow[4] != "100" {
		t.Errorf("Expected total enrollments '100', got '%s'", dataRow[4])
	}
	if dataRow[8] != "30.00" {
		t.Errorf("Expected completion rate '30.00', got '%s'", dataRow[8])
	}
	if dataRow[10] != "450.00" {
		t.Errorf("Expected credit hours '450.00', got '%s'", dataRow[10])
	}
}

func TestFacilityComparisonReportToCSV(t *testing.T) {
	lastActivity := time.Date(2024, 3, 20, 0, 0, 0, 0, time.UTC)

	data := []FacilityComparisonReportRow{
		{
			FacilityName:       "Facility A",
			TotalPrograms:      15,
			ActivePrograms:     12,
			TotalEnrollments:   200,
			ActiveEnrollments:  150,
			CompletionRate:     45.5,
			AttendanceRate:     70.2,
			TopProgramType:     "Academic",
			TotalCreditHours:   1200.5,
			CertificatesEarned: 85,
			LastActivityDate:   &lastActivity,
		},
		{
			FacilityName:       "Facility B",
			TotalPrograms:      8,
			ActivePrograms:     6,
			TotalEnrollments:   120,
			ActiveEnrollments:  90,
			CompletionRate:     38.0,
			AttendanceRate:     62.5,
			TopProgramType:     "Vocational",
			TotalCreditHours:   650.0,
			CertificatesEarned: 42,
			LastActivityDate:   nil,
		},
	}

	report := FacilityComparisonReportData{Data: data}
	csv, err := report.ToCSV()
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(csv) != 3 {
		t.Fatalf("Expected 3 rows (header + 2 data), got %d", len(csv))
	}

	firstDataRow := csv[1]
	if firstDataRow[0] != "Facility A" {
		t.Errorf("Expected facility 'Facility A', got '%s'", firstDataRow[0])
	}
	if firstDataRow[10] != "2024-03-20" {
		t.Errorf("Expected last activity '2024-03-20', got '%s'", firstDataRow[10])
	}

	secondDataRow := csv[2]
	if secondDataRow[10] != "" {
		t.Errorf("Expected empty last activity date, got '%s'", secondDataRow[10])
	}
}

func TestFormatNullableInt(t *testing.T) {
	tests := []struct {
		name     string
		input    *int
		expected string
	}{
		{"nil value", nil, ""},
		{"zero value", intPtr(0), "0"},
		{"positive value", intPtr(42), "42"},
		{"negative value", intPtr(-10), "-10"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := FormatNullableInt(tt.input)
			if result != tt.expected {
				t.Errorf("Expected '%s', got '%s'", tt.expected, result)
			}
		})
	}
}

func TestFormatNullableString(t *testing.T) {
	tests := []struct {
		name     string
		input    *string
		expected string
	}{
		{"nil value", nil, ""},
		{"empty string", strPtr(""), ""},
		{"normal string", strPtr("test"), "test"},
		{"string with spaces", strPtr("test string"), "test string"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := FormatNullableString(tt.input)
			if result != tt.expected {
				t.Errorf("Expected '%s', got '%s'", tt.expected, result)
			}
		})
	}
}

func intPtr(i int) *int {
	return &i
}

func strPtr(s string) *string {
	return &s
}
