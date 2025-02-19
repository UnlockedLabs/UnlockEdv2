package handlers

import (
	"UnlockEdv2/src/models"
	"context"
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
	log "github.com/sirupsen/logrus"
)

// sLog is a wrapper around the log.Fields map and is implemented by the handleError method, this struct is not intended to be accessed directly and was created to make adding key/values and logging more efficient.
type sLog struct{ f logrus.Fields }

func (slog sLog) info(args ...interface{}) {
	logrus.WithFields(slog.f).Info(args...)
}

func (slog sLog) infof(format string, args ...interface{}) {
	logrus.WithFields(slog.f).Infof(format, args...)
}

func (slog sLog) debug(args ...interface{}) {
	logrus.WithFields(slog.f).Debug(args...)
}

func (slog sLog) debugf(format string, args ...interface{}) {
	logrus.WithFields(slog.f).Debugf(format, args...)
}

func (slog sLog) warn(args ...interface{}) {
	logrus.WithFields(slog.f).Warn(args...)
}

func (slog sLog) warnf(format string, args ...interface{}) {
	logrus.WithFields(slog.f).Warnf(format, args...)
}

func (slog sLog) error(args ...interface{}) {
	logrus.WithFields(slog.f).Error(args...)
}

func (slog sLog) errorf(format string, args ...interface{}) {
	logrus.WithFields(slog.f).Errorf(format, args...)
}

func (slog *sLog) add(key string, value interface{}) {
	slog.f[key] = value
}

func (srv *Server) getPaginationInfo(r *http.Request) (int, int) {
	page := r.URL.Query().Get("page")
	perPage := r.URL.Query().Get("per_page")
	if page == "" {
		page = "1"
	}
	if perPage == "" {
		perPage = "10"
	}
	intPage, err := strconv.Atoi(page)
	if err != nil {
		intPage = 1
	}
	intPerPage, err := strconv.Atoi(perPage)
	if err != nil {
		intPerPage = 10
	}
	return intPage, intPerPage
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
	if order == "" && orderBy != "" {
		orderBySplit := strings.Fields(orderBy)
		if len(orderBySplit) > 1 {
			orderBy = orderBySplit[0]
			order = orderBySplit[1]
		}
	}
	if order != "asc" && order != "desc" {
		order = "asc"
	}
	search := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("search")))
	tags := r.URL.Query()["tags"]
	all := r.URL.Query().Get("all") == "true"
	return models.QueryContext{
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
	}
}

type emailReq struct {
	to       string
	from     string
	subject  string
	bodyText string
	bodyHTML string
}

func newEmailReq(to, from, subject, bodyText, bodyHTML string) *emailReq {
	return &emailReq{
		to:       to,
		from:     from,
		subject:  subject,
		bodyText: bodyText,
		bodyHTML: bodyHTML,
	}
}

func newAllowlistRequest(user *models.User, link *models.HelpfulLink) *emailReq {
	reqTime := time.Now().Format("2006-01-02 15:04:05")
	emailStr := `A new Helpful Link has been added to the UnlockEd system by an Administrator.
	In order for it to successfully become available to users, it must be allow-listed globally after your pending review of the site. 
	It may already be available, but the Administrator has chosen to submit it for allow-listing`
	emailTo := os.Getenv("DOMAIN_ADMIN_EMAIL")
	emailFrom := os.Getenv("EMAIL_FROM")
	bodyHtml := fmt.Sprintf(`<div style="font-family: Arial, sans-serif; font-size: 16px;">
        <p>Incoming request for review and allow-listing of <strong>%s</strong>.</p>
        <p>We have received the following request from:</p>
        <ul>
            <li><strong>Admin:</strong> %s</li>
            <li><strong>Time:</strong> %s</li>
        </ul>
		<li><strong>URL:</strong> <a href="%s">Download Resume</a></li>
		<br />
		<br />
		<p><strong>NOTE:</strong> 
		This website may already be available, but the Administrator has chosen to submit it for allow-listing.</p>
		<p>Although this request was made by an Administrator, always be sure to properly review the contents of the site before allow-listing.</p>`, link.Url, user.Email, reqTime, link.Url)
	return newEmailReq(emailTo, emailFrom, "UnlockEd - Request for Allowlist", emailStr, bodyHtml)
}

func (srv *Server) sendEmail(ctx context.Context, r *emailReq) error {
	charset := "UTF-8"
	input := &sesv2.SendEmailInput{
		Content: &types.EmailContent{
			Simple: &types.Message{
				Subject: &types.Content{
					Data:    aws.String(r.subject),
					Charset: &charset,
				},
				Body: &types.Body{
					Text: &types.Content{
						Data:    aws.String(r.bodyText),
						Charset: &charset,
					},
					Html: &types.Content{
						Data:    aws.String(r.bodyHTML),
						Charset: &charset,
					},
				},
			},
		},
		Destination: &types.Destination{
			ToAddresses: []string{r.to, os.Getenv("CC_EMAIL")},
		},
		FromEmailAddress: aws.String(r.from),
	}
	if !srv.dev {
		_, err := srv.sesClient.SendEmail(ctx, input)
		if err != nil {
			log.Printf("error sending email: %v\n", err)
			return fmt.Errorf("failed to send email via SES: %v", err)
		}
	}
	return nil
}
