package handlers

import (
	"UnlockEdv2/src/models"
	"context"
	"encoding/json"
	"fmt"
	"html"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/sesv2"
	"github.com/aws/aws-sdk-go-v2/service/sesv2/types"
	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerOpenContentRoutes() []routeDef {
	axx := models.OpenContentAccess
	return []routeDef{
		featureRoute("GET /api/open-content", srv.handleIndexOpenContent, axx),
		featureRoute("GET /api/open-content/favorites", srv.handleGetUserFavoriteOpenContent, axx),
		featureRoute("PUT /api/open-content/{id}/bookmark", srv.handleBookmarkOpenContent, axx),
		featureRoute("GET /api/open-content/favorite-groupings", srv.handleGetUserFavoriteOpenContentGroupings, axx),
		featureRoute("POST /api/open-content/request-content", srv.handleRequestOpenContent, axx),
	}
}

func (srv *Server) handleIndexOpenContent(w http.ResponseWriter, r *http.Request, log sLog) error {
	only := r.URL.Query().Get("all")
	var all bool
	if userIsAdmin(r) && strings.ToLower(strings.TrimSpace(only)) == "true" {
		all = true
	}
	content, err := srv.Db.GetOpenContent(all)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, content)
}

func (srv *Server) handleGetUserFavoriteOpenContent(w http.ResponseWriter, r *http.Request, log sLog) error {
	args := srv.getQueryContext(r)
	favorites, err := srv.Db.GetUserFavorites(&args)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writePaginatedResponse(w, http.StatusOK, favorites, args.IntoMeta())
}

func (srv *Server) handleGetUserFavoriteOpenContentGroupings(w http.ResponseWriter, r *http.Request, log sLog) error {
	args := srv.getQueryContext(r)
	favorites, err := srv.Db.GetUserFavoriteGroupings(&args)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, favorites)
}

func (srv *Server) handleBookmarkOpenContent(w http.ResponseWriter, r *http.Request, log sLog) error {
	var requestBody struct {
		Name                  string `json:"name,omitempty"`
		ContentURL            string `json:"content_url,omitempty"`
		OpenContentProviderId uint   `json:"open_content_provider_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	contentID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "Content ID")
	}
	userID := srv.getUserID(r)
	contentParams := models.OpenContentParams{
		UserID:                userID,
		ContentID:             uint(contentID),
		Name:                  requestBody.Name,
		ContentURL:            requestBody.ContentURL,
		OpenContentProviderID: requestBody.OpenContentProviderId,
	}
	err = srv.Db.BookmarkOpenContent(&contentParams)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, "Bookmark toggled successfully")
}

func (srv *Server) handleRequestOpenContent(w http.ResponseWriter, r *http.Request, log sLog) error {
	var req struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return newBadRequestServiceError(err, "error reading content requests")
	}
	context := srv.getQueryContext(r).Ctx
	claims := r.Context().Value(ClaimsKey).(*Claims)
	username := claims.Username
	facilityName := claims.FacilityName
	subject := "Content Request - " + username + " - " + facilityName
	bodyHTML := getBodyHTML(username, facilityName, req.Content)
	fmt.Printf("body html is %s", bodyHTML)
	srv.sendEmail(context, subject, "Content requests recieved for UnlockEd", bodyHTML)
	return writeJsonResponse(w, http.StatusOK, "content requests sent")
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
		log.Printf("error sending email: %v\n", err)
		return fmt.Errorf("failed to send email via SES: %v", err)
	}
	return nil
}

func getBodyHTML(username, facility, bodyText string) string {
	pasteableString := `=SPLIT("` + username + `|` + facility + `|` + bodyText + `", "|")`
	return fmt.Sprintf(`<div style="font-family: Arial, sans-serif; font-size: 16px;">
        <p>Content Request from %s at %s</p>
        <p>We have received the following information:</p>
		<table>
			<thead>
				<tr>
					<th>Username</th>
					<th>Facility Name</th>
					<th>Content Request</th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<td>%s</td>
					<td>%s</td>
					<td>%s</td>
				</tr>
			</tbody>
		</table>
		<p>Pasteable response:</p>
		<p>%s</p>
    </div>`, html.EscapeString(username), html.EscapeString(facility), html.EscapeString(username), html.EscapeString(facility), html.EscapeString(bodyText), pasteableString)
}
