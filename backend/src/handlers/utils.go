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
	tz := claims.TimeZone
	return models.QueryContext{
		Params:     r.URL.Query(),
		Ctx:        r.Context(),
		Page:       page,
		PerPage:    perPage,
		FacilityID: uint(facilityID),
		UserID:     uint(userID),
		OrderBy:    orderBy,
		Order:      order,
		IsAdmin:    claims.isAdmin(),
		Search:     search,
		Tags:       tags,
		All:        all,
		Timezone:   tz,
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

// commented this out due to it not being used, could be used in the future?
//
//	func deptAdminFeatureRoute(method string, handler HttpFunc, features ...models.FeatureAccess) routeDef {
//		return routeDef{
//			routeMethod: method,
//			handler:     handler,
//			admin:       true,
//			features:    features,
//			resolver: func(tx *database.DB, r *http.Request) bool {
//				return r.Context().Value(ClaimsKey).(*Claims).canSwitchFacility()
//			},
//		}
//	}
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

func (srv *Server) sendEmail(ctx context.Context, subject, bodyText, bodyHTML string) error {
	input := &sesv2.SendEmailInput{
		Content: &types.EmailContent{
			Simple: &types.Message{
				Subject: &types.Content{
					Data:    aws.String(subject),
					Charset: aws.String("UTF-8"),
				},
				Body: &types.Body{
					Text: &types.Content{
						Data:    aws.String(bodyText),
						Charset: aws.String("UTF-8"),
					},
					Html: &types.Content{
						Data:    aws.String(bodyHTML),
						Charset: aws.String("UTF-8"),
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
