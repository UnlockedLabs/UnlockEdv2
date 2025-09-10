package handlers

import (
	"UnlockEdv2/src/database"
	"UnlockEdv2/src/models"
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/sesv2"
	"github.com/aws/aws-sdk-go-v2/service/sesv2/types"
	"github.com/go-pdf/fpdf"
	"github.com/sirupsen/logrus"
)

// sLog is a wrapper around the log.Fields map and is implemented by the handleError method, this struct is not intended to be accessed directly and was created to make adding key/values and logging more efficient.
type sLog struct{ f logrus.Fields }

func (log sLog) adminAudit() {
	log.f["audit"] = "admin_action"
	logrus.WithFields(log.f).Println()
}

func (slog sLog) auditDetails(action string) {
	slog.f["action"] = action
}

func (slog sLog) info(args ...any) {
	logrus.WithFields(slog.f).Info(args...)
}

func (slog sLog) infof(format string, args ...any) {
	logrus.WithFields(slog.f).Infof(format, args...)
}

func (slog sLog) debug(args ...any) {
	logrus.WithFields(slog.f).Debug(args...)
}

func (slog sLog) debugf(format string, args ...any) {
	logrus.WithFields(slog.f).Debugf(format, args...)
}

func (slog sLog) warn(args ...any) {
	logrus.WithFields(slog.f).Warn(args...)
}

func (slog sLog) warnf(format string, args ...any) {
	logrus.WithFields(slog.f).Warnf(format, args...)
}

func (slog sLog) error(args ...any) {
	logrus.WithFields(slog.f).Error(args...)
}

func (slog sLog) errorf(format string, args ...any) {
	logrus.WithFields(slog.f).Errorf(format, args...)
}

func (slog *sLog) add(key string, value any) {
	slog.f[key] = value
}

func (srv *Server) getQueryContext(r *http.Request) models.QueryContext {
	var facilityID, userID uint
	claims := r.Context().Value(ClaimsKey).(*Claims)
	f, err := strconv.Atoi(r.URL.Query().Get("facility_id"))
	if err != nil {
		facilityID = claims.FacilityID
	} else {
		facilityID = uint(f)
	}
	u, err := strconv.Atoi(r.URL.Query().Get("user_id"))
	if err != nil {
		userID = claims.UserID
	} else {
		userID = uint(u)
	}
	page, perPage := srv.getPaginationInfo(r)
	orderBy := strings.ToLower(r.URL.Query().Get("order_by"))
	order := strings.ToLower(r.URL.Query().Get("order"))
	if orderBy != "" && order == "" {
		orderBySplit := strings.Fields(orderBy)
		if len(orderBySplit) > 1 {
			orderBy = orderBySplit[0]
			order = orderBySplit[1]
		}
	}
	search := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("search")))
	tags := r.URL.Query()["tags"]
	all := r.URL.Query().Get("all") == "true"
	includeDeactivated := r.URL.Query().Get("include_deactivated") == "true"
	tz := claims.TimeZone
	return models.QueryContext{
		Params:             r.URL.Query(),
		Ctx:                r.Context(),
		Page:               page,
		PerPage:            perPage,
		FacilityID:         uint(facilityID),
		UserID:             uint(userID),
		OrderBy:            orderBy,
		Order:              order,
		IsAdmin:            claims.isAdmin(),
		Search:             search,
		Tags:               tags,
		All:                all,
		Timezone:           tz,
		IncludeDeactivated: includeDeactivated,
	}
}

func getDateRange(r *http.Request) (*models.DateRange, error) {
	tz, err := time.LoadLocation(r.Context().Value(ClaimsKey).(*Claims).TimeZone)
	if err != nil {
		tz = time.UTC
	}

	parseDate := func(dateStr string) (time.Time, error) {
		formats := []string{"02-01-2006", "2006-01-02", "2006-01-02T15:04:05Z07:00"}
		for _, format := range formats {
			if t, err := time.Parse(format, dateStr); err == nil {
				return t, nil
			}
		}
		return time.Time{}, errors.New("invalid date format")
	}

	start, err := parseDate(r.URL.Query().Get("start_dt"))
	if err != nil {
		// if start is not provided, use two weeks ago
		start = time.Now().Add(-14 * 24 * time.Hour)
	}
	start = start.In(tz)
	end, err := parseDate(r.URL.Query().Get("end_dt"))
	if err != nil {
		// if end is not provided, use two weeks from now
		end = time.Now().Add(14 * 24 * time.Hour)
	}
	end = end.In(tz)
	if start.After(end) {
		return nil, errors.New("start date cannot be after end date")
	}
	return &models.DateRange{
		Start: start,
		End:   end,
		Tzone: tz,
	}, nil
}

func newRoute(method string, handler HttpFunc) routeDef {
	return routeDef{
		routeMethod: method,
		handler:     handler,
		admin:       false,
		features:    []models.FeatureAccess{},
	}
}

func newAdminRoute(method string, handler HttpFunc) routeDef {
	return routeDef{
		routeMethod: method,
		handler:     handler,
		admin:       true,
		features:    []models.FeatureAccess{},
	}
}

func newDeptAdminRoute(method string, handler HttpFunc) routeDef {
	return routeDef{
		routeMethod: method,
		handler:     handler,
		admin:       true,
		features:    []models.FeatureAccess{},
		resolver: func(tx *database.DB, r *http.Request) bool {
			return r.Context().Value(ClaimsKey).(*Claims).canSwitchFacility()
		},
	}
}
func newSystemAdminRoute(method string, handler HttpFunc) routeDef {
	return routeDef{
		routeMethod: method,
		handler:     handler,
		admin:       true,
		features:    []models.FeatureAccess{},
		resolver: func(tx *database.DB, r *http.Request) bool {
			return r.Context().Value(ClaimsKey).(*Claims).Role == models.SystemAdmin
		},
	}
}

func validatedRoute(method string, handler HttpFunc, validate RouteResolver) routeDef {
	return routeDef{
		routeMethod: method,
		handler:     handler,
		admin:       false,
		features:    []models.FeatureAccess{},
		resolver:    validate,
	}
}

func validatedAdminRoute(method string, handler HttpFunc, validate RouteResolver) routeDef {
	return routeDef{
		routeMethod: method,
		handler:     handler,
		admin:       true,
		features:    []models.FeatureAccess{},
		resolver:    validate,
	}
}

func featureRoute(method string, handler HttpFunc, features ...models.FeatureAccess) routeDef {
	return routeDef{
		routeMethod: method,
		handler:     handler,
		admin:       false,
		features:    features,
	}
}

func adminFeatureRoute(method string, handler HttpFunc, features ...models.FeatureAccess) routeDef {
	return routeDef{
		routeMethod: method,
		handler:     handler,
		admin:       true,
		features:    features,
		resolver:    nil,
	}
}

func validatedFeatureRoute(method string, handler HttpFunc, feature models.FeatureAccess, resolver RouteResolver) routeDef {
	return routeDef{
		routeMethod: method,
		handler:     handler,
		admin:       false,
		features:    []models.FeatureAccess{feature},
		resolver:    resolver,
	}
}

func adminValidatedFeatureRoute(method string, handler HttpFunc, features models.FeatureAccess, validate RouteResolver) routeDef {
	return routeDef{
		routeMethod: method,
		handler:     handler,
		admin:       true,
		features:    []models.FeatureAccess{features},
		resolver:    validate,
	}
}

func enforceDeptAdminForAllQuery(tx *database.DB, r *http.Request) bool {
	claims := r.Context().Value(ClaimsKey).(*Claims)
	all := r.URL.Query().Get("all") == "true"
	if all && !claims.canSwitchFacility() {
		return false
	}
	return claims.isAdmin()
}

func (srv *Server) sendEmail(ctx context.Context, subject, bodyText, bodyHTML string) error {
	charset := aws.String("UTF-8")
	input := &sesv2.SendEmailInput{
		Content: &types.EmailContent{
			Simple: &types.Message{
				Subject: &types.Content{
					Data:    aws.String(subject),
					Charset: charset,
				},
				Body: &types.Body{
					Text: &types.Content{
						Data:    aws.String(bodyText),
						Charset: charset,
					},
					Html: &types.Content{
						Data:    aws.String(bodyHTML),
						Charset: charset,
					},
				},
			},
		},
		Destination: &types.Destination{
			ToAddresses: []string{os.Getenv("TO_EMAIL")},
		},
		FromEmailAddress: aws.String(os.Getenv("FROM_EMAIL")),
	}

	_, err := srv.sesClient.SendEmail(ctx, input)
	if err != nil {
		logrus.Printf("error sending email: %v\n", err)
		return fmt.Errorf("failed to send email via SES: %v", err)
	}
	return nil
}

func writeLine(pdf *fpdf.Fpdf, text string) {
	pdf.Cell(0, 10, text)
	pdf.Ln(5)
}

func drawDataTable(pdf *fpdf.Fpdf, headers []string, rows [][]string, colWidths []float64) {
	pdf.SetFont("Arial", "B", 10)
	drawTableRow(pdf, headers, colWidths, true) //draw header

	pdf.SetFont("Arial", "", 10)
	for _, row := range rows {
		drawTableRow(pdf, row, colWidths, false) //draw row
	}
}

func drawTableRow(pdf *fpdf.Fpdf, cells []string, colWidths []float64, isHeader bool) {
	fill := false
	style := "D"
	align := "C"

	if isHeader {
		pdf.SetFillColor(240, 240, 240)
		fill = true
		style = "FD"
	}

	maxRowHeight := 0.0
	for i, cell := range cells { //have to calc height here
		lines := pdf.SplitLines([]byte(cell), colWidths[i])
		height := float64(len(lines)) * 5
		if height > maxRowHeight {
			maxRowHeight = height
		}
	}
	if !isHeader && maxRowHeight < 10 {
		maxRowHeight = 10
	}

	x, y := pdf.GetXY()
	for i, cell := range cells { //can build the rows
		pdf.Rect(x, y, colWidths[i], maxRowHeight, style)

		lines := pdf.SplitLines([]byte(cell), colWidths[i])
		textHeight := float64(len(lines)) * 5
		yText := y + (maxRowHeight-textHeight)/2

		pdf.SetXY(x, yText)
		pdf.MultiCell(colWidths[i], 5, cell, "", align, fill)

		x += colWidths[i]
		pdf.SetXY(x, y)
	}
	pdf.Ln(maxRowHeight)
}

// takes a timestamp (time.RFC3339) returns date in the following format: MMM, D YYYY
func formatDateForDisplay(dateStr string) string {
	if dateStr == "" {
		return "--"
	}
	parsed, err := time.Parse(time.RFC3339, dateStr)
	if err != nil || parsed.IsZero() {
		return "--"
	}
	return parsed.Format("Jan 2, 2006")
}

// returns the following format based upon a total of minutes: 5 hours 6 minutes
func formatDurationFromMinutes(totalMinutes float64) string {
	minutes := int(totalMinutes)
	if minutes <= 0 {
		return "none"
	}

	hours := minutes / 60
	mins := minutes % 60

	var durations []string
	if hours > 0 {
		if hours == 1 {
			durations = append(durations, fmt.Sprintf("%d hour", hours))
		} else {
			durations = append(durations, fmt.Sprintf("%d hours", hours))
		}
	}
	if mins > 0 {
		if mins == 1 {
			durations = append(durations, fmt.Sprintf("%d minute", mins))
		} else {
			durations = append(durations, fmt.Sprintf("%d minutes", mins))
		}
	}
	return strings.Join(durations, " ")
}
