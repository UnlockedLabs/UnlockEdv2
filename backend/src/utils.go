package src

import (
	"UnlockEdv2/src/models"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"strings"
)

func FilterMap[T any](ss []T, test func(T) bool) (ret []T) {
	for _, s := range ss {
		if test(s) {
			ret = append(ret, s)
		}
	}
	return
}

func IterMap[T any, E any](fun func(T) E, arr []T) []E {
	applied := []E{}
	for _, item := range arr {
		applied = append(applied, fun(item))
	}
	return applied
}

func ParseCSVFile(fileBytes []byte) ([][]string, error) {
	reader := csv.NewReader(strings.NewReader(string(fileBytes)))
	reader.TrimLeadingSpace = true

	var records [][]string
	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("error parsing CSV: %w", err)
		}
		records = append(records, record)
	}

	if len(records) == 0 {
		return nil, errors.New("file is empty - no data found")
	}

	return records, nil
}

func normalizeHeaderName(header string) string {
	normalized := strings.ToLower(strings.TrimSpace(header))
	normalized = strings.ReplaceAll(normalized, "_", " ")
	normalized = strings.ReplaceAll(normalized, "-", " ")
	normalized = strings.Join(strings.Fields(normalized), " ")
	return normalized
}

func createHeaderMapping(headers []string) map[string]int {
	mapping := make(map[string]int)
	for i, header := range headers {
		normalized := normalizeHeaderName(header)
		mapping[normalized] = i
	}
	return mapping
}

// HeaderMapping holds the column indexes for required fields
type HeaderMapping struct {
	LastNameIdx  int
	FirstNameIdx int
	ResidentIdx  int
	UsernameIdx  int // -1 if not present
}

func ValidateCSVHeaders(headers []string) (*HeaderMapping, error) {
	if len(headers) == 0 {
		return nil, errors.New("file could not be processed: missing required headers")
	}

	mapping := createHeaderMapping(headers)

	requiredFields := map[string][]string{
		"last_name":   {"last name", "lastname", "surname", "family name", "NameLast", "LastName", "last_name", "name_last"},
		"first_name":  {"first name", "firstname", "given name", "name first", "NameFirst", "FirstName", "first_name", "name_first"},
		"resident_id": {"resident id", "residentid", "resident", "id", "doc id", "docid", "resident_id", "doc_id", "docid", "residentid", "resident id", "OffenderID", "offenderid", "offender id", "Offender ID", "OffenderId", "OffenderID", "offender_id"},
	}

	optionalFields := map[string][]string{
		"username": {"username", "user name", "login", "user", "user_name", "UserName", "user_name", "login name", "loginname"},
	}

	headerMap := &HeaderMapping{
		LastNameIdx:  -1,
		FirstNameIdx: -1,
		ResidentIdx:  -1,
		UsernameIdx:  -1,
	}

	for field, variations := range requiredFields {
		found := false
		for _, variation := range variations {
			if idx, exists := mapping[variation]; exists {
				found = true
				switch field {
				case "last_name":
					headerMap.LastNameIdx = idx
				case "first_name":
					headerMap.FirstNameIdx = idx
				case "resident_id":
					headerMap.ResidentIdx = idx
				}
				break
			}
		}
		if !found {
			return nil, fmt.Errorf("file could not be processed: missing required header. Need one of: %s", strings.Join(variations, ", "))
		}
	}

	for field, variations := range optionalFields {
		for _, variation := range variations {
			if idx, exists := mapping[variation]; exists {
				switch field {
				case "username":
					headerMap.UsernameIdx = idx
				}
				break
			}
		}
	}

	return headerMap, nil
}

// signature to avoid import cycle
type UserIdentityChecker func(username string, docID string) (bool, bool)

func ValidateUserRow(row []string, rowNum int, headerMap *HeaderMapping, existingResidentIDs map[string]int, checkIdentity UserIdentityChecker) (*models.ValidatedUserRow, *models.InvalidUserRow) {
	if len(row) == 0 {
		return nil, &models.InvalidUserRow{
			ValidatedUserRow: models.ValidatedUserRow{
				RowNumber: rowNum,
			},
			ErrorReasons: []string{"Row is empty"},
		}
	}

	isEmpty := true
	for _, field := range row {
		if strings.TrimSpace(field) != "" {
			isEmpty = false
			break
		}
	}
	if isEmpty {
		return nil, &models.InvalidUserRow{
			ValidatedUserRow: models.ValidatedUserRow{
				RowNumber: rowNum,
			},
			ErrorReasons: []string{"Row is empty"},
		}
	}

	var lastName, firstName, residentID, username string
	var errors []string

	if headerMap.LastNameIdx < len(row) {
		lastName = strings.TrimSpace(row[headerMap.LastNameIdx])
	}
	if headerMap.FirstNameIdx < len(row) {
		firstName = strings.TrimSpace(row[headerMap.FirstNameIdx])
	}
	if headerMap.ResidentIdx < len(row) {
		residentID = strings.TrimSpace(row[headerMap.ResidentIdx])
	}

	if headerMap.UsernameIdx != -1 && headerMap.UsernameIdx < len(row) {
		username = strings.TrimSpace(row[headerMap.UsernameIdx])
	}

	if lastName == "" {
		errors = append(errors, "Missing required field - Last Name")
	}
	if firstName == "" {
		errors = append(errors, "Missing required field - First Name")
	}
	if residentID == "" {
		errors = append(errors, "Missing required field - Resident ID")
	}

	if residentID != "" {
		if existingRowNum, exists := existingResidentIDs[residentID]; exists {
			errors = append(errors, fmt.Sprintf("Duplicate Resident ID - also found in row %d", existingRowNum))
		} else {
			existingResidentIDs[residentID] = rowNum
		}
	}

	if residentID != "" {
		_, docExists := checkIdentity("", residentID)
		if docExists {
			errors = append(errors, "Resident ID already exists")
		}
		if username != "" {
			usernameExists, _ := checkIdentity(username, "")
			if usernameExists {
				errors = append(errors, "Username already exists in system")
			}
		}
	}

	if username == "" && residentID != "" {
		username = residentID
	}

	if username != "" && residentID != "" {
		usernameExists, _ := checkIdentity(username, "")
		if usernameExists {
			errors = append(errors, "Generated username already exists in system")
		}
	}

	if len(errors) > 0 {
		return nil, &models.InvalidUserRow{
			ValidatedUserRow: models.ValidatedUserRow{
				RowNumber:  rowNum,
				LastName:   lastName,
				FirstName:  firstName,
				ResidentID: residentID,
				Username:   username,
			},
			ErrorReasons: errors,
		}
	}

	return &models.ValidatedUserRow{
		RowNumber:  rowNum,
		LastName:   lastName,
		FirstName:  firstName,
		ResidentID: residentID,
		Username:   username,
	}, nil
}

func GenerateErrorCSV(invalidRows []models.InvalidUserRow) ([]byte, error) {
	var csvContent strings.Builder

	headers := []string{"LastName", "FirstName", "ResidentID", "Username", "Error Reason"}
	csvContent.WriteString(strings.Join(headers, ",") + "\n")

	for _, row := range invalidRows {
		errorReason := strings.Join(row.ErrorReasons, "; ")
		line := []string{row.LastName, row.FirstName, row.ResidentID, row.Username, errorReason}

		for i, field := range line {
			if strings.Contains(field, ",") || strings.Contains(field, "\"") {
				line[i] = fmt.Sprintf("\"%s\"", strings.ReplaceAll(field, "\"", "\"\""))
			}
		}

		csvContent.WriteString(strings.Join(line, ",") + "\n")
	}

	return []byte(csvContent.String()), nil
}
