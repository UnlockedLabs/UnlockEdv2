package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"

	client "github.com/ory/kratos-client-go"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerOryRoutes() []routeDef {
	return []routeDef{newSystemAdminRoute("DELETE /api/identities/sync", srv.handleDeleteAllKratosIdentities)}
}

func (srv *Server) handleDeleteAllKratosIdentities(w http.ResponseWriter, r *http.Request, log sLog) error {
	if err := srv.deleteAllKratosIdentities(r.Context()); err != nil {
		return newInternalServerServiceError(err, "error communicating with Ory Kratos")
	}
	return writeJsonResponse(w, http.StatusNoContent, "identities deleted successfully")
}

func (srv *Server) deleteAllKratosIdentities(ctx context.Context) error {
	identities, err := srv.handleFindKratosIdentities(ctx)
	if err != nil {
		log.Errorln("unable to fetch all identities from Ory Kratos")
		return err
	}
	for _, user := range identities {
		id := user.GetId()
		resp, err := srv.OryClient.IdentityAPI.DeleteIdentity(ctx, id).Execute()
		if err != nil {
			log.WithFields(log.Fields{"identity": id}).Errorln("unable to delete identity from Ory Kratos")
			continue
		}
		if resp.StatusCode != 204 {
			log.WithFields(log.Fields{"identity": id}).Errorln("unable to delete identity from Ory Kratos")
			continue
		} else {
			continue
		}
	}
	return nil
}

func (srv *Server) deleteIdentityInKratos(ctx context.Context, kratosId *string) error {
	resp, err := srv.OryClient.IdentityAPI.DeleteIdentity(ctx, *kratosId).Execute()
	if err != nil {
		log.WithField("identity", kratosId).Errorln("unable to delete identity from Ory Kratos")
		return err
	}
	if resp.StatusCode != 204 {
		log.WithField("identity", kratosId).Errorln("unable to delete identity from Ory Kratos")
		return errors.New("unable to delete identity from Ory isntance")
	}
	return nil
}

func (srv *Server) handleFindKratosIdentities(ctx context.Context) ([]client.Identity, error) {
	identities, resp, err := srv.OryClient.IdentityAPI.ListIdentities(ctx).Execute()
	if err != nil {
		log.Error("Error getting identities from kratos integration")
		return nil, err
	}
	if resp.StatusCode != 200 {
		log.Errorf("kratos identites response failed with code %d", resp.StatusCode)
		return nil, errors.New("kratos client failed to send request")
	}
	log.WithFields(log.Fields{"identities": identities}).Info("kratos identities found")
	return identities, nil
}

func (srv *Server) validateUserIDKratos(id string) error {
	_, resp, err := srv.OryClient.IdentityAPI.GetIdentity(context.Background(), id).Execute()
	if err != nil {
		log.WithField("id", id).Error("unable to fetch and validate identity in kratos")
		return err
	}
	if resp.StatusCode != 200 {
		log.WithField("id", id).Error("unable to fetch and validate identity in kratos")
		return errors.New("identity not found in kratos instance")
	}
	return nil
}

func (srv *Server) HandleCreateUserKratos(username, password string) error {
	user, err := srv.Db.GetUserByUsername(username)
	if err != nil {
		log.Error("user not found immediately after creation, this should not happen")
		return err
	}
	traits := user.GetTraits()
	traits["password_reset"] = true
	identity := client.NewCreateIdentityBody("default", traits)
	created, resp, err := srv.OryClient.IdentityAPI.CreateIdentity(context.Background()).CreateIdentityBody(*identity).Execute()
	if err != nil {
		log.Errorf("Error creating identity: %v", err)
		return err
	}
	if resp.StatusCode != http.StatusCreated {
		log.Errorf("Error creating identity: %v", resp.StatusCode)
		return errors.New("error creating identity")
	}
	user.KratosID = created.GetId()
	claims := &Claims{
		UserID:        user.ID,
		KratosID:      user.KratosID,
		PasswordReset: true,
		FacilityID:    user.FacilityID,
	}
	err = srv.handleUpdatePasswordKratos(claims, password, true)
	if err != nil {
		log.Error("Error updating password for new kratos user")
		return err
	}
	err = srv.Db.UpdateUser(user)
	if err != nil {
		log.Error("Error updating user")
		return err
	}
	log.Infof("user created successfully + identity registered with kratos: %v", user)
	return nil
}

func (srv *Server) updateUserTraitsInKratos(claims *Claims) error {
	update := client.UpdateIdentityBody{
		Traits: claims.getTraits(),
	}
	updated, resp, err := srv.OryClient.IdentityAPI.UpdateIdentity(context.Background(), claims.KratosID).UpdateIdentityBody(update).Execute()
	if err != nil {
		log.Errorf("Error updating identity: %v", err)
		return err
	}
	if resp.StatusCode != http.StatusOK {
		log.Errorf("Error updating identity: %v", resp.StatusCode)
		return errors.New("error updating identity")
	}
	log.Infof("identity updated successfully: %v", updated.GetId())
	return nil
}

func (srv *Server) handleUpdatePasswordKratos(claims *Claims, password string, reset bool) error {
	if claims.KratosID == "" {
		return errors.New("kratos ID is empty, please create user in kratos first")
	}
	log.Tracef("updating password for user: %s and KratosID: %s", claims.Username, claims.KratosID)
	identity, resp, err := srv.OryClient.IdentityAPI.GetIdentity(context.Background(), claims.KratosID).Execute()
	if err != nil {
		log.Errorf("Error fetching identity: %v", err)
		return err
	}
	if resp.StatusCode != http.StatusOK {
		log.Errorf("Error fetching identity: %v", resp.StatusCode)
		return errors.New("error fetching identity")
	}
	traits := identity.GetTraits().(map[string]interface{})
	traits["password_reset"] = reset
	body := map[string]interface{}{
		"credentials": map[string]interface{}{
			"password": map[string]interface{}{
				"config": map[string]interface{}{
					"password": password,
				},
			},
		},
		"metadata_admin":  nil,
		"metadata_public": nil,
		"schema_id":       identity.GetSchemaId(),
		"state":           identity.GetState(),
		"traits":          traits,
	}
	byte, err := json.Marshal(body)
	if err != nil {
		log.Errorf("Error updating identity with user password: %v", err)
		return err
	}
	req, err := http.NewRequest(http.MethodPut, os.Getenv("KRATOS_ADMIN_URL")+"/admin/identities/"+identity.GetId(), bytes.NewBuffer(byte))
	if err != nil {
		log.Errorf("Error creating identity request to kratos: %v", err)
		return err
	}
	req.Header.Set("Authorization", "Bearer "+os.Getenv("ORY_TOKEN"))
	req.Header.Set("Content-Type", "application/json")
	resp, err = srv.Client.Do(req)
	if err != nil {
		log.Errorf("Error sending identity request to kratos: %v", err)
		return err
	}
	if resp.StatusCode != http.StatusOK {
		log.Errorf("Error updating identity with user password: %v", resp.StatusCode)
		return errors.New("error updating identity")
	}
	log.Infof("password updated successfully for user: %s and KratosID: %s", claims.Username, identity.GetId())
	return nil
}

func (srv *Server) updateFacilityInKratosIdentity(userID int, transFacilityID int) error {
	ctx := context.Background()
	user, err := srv.Db.GetUserByID(uint(userID))
	if err != nil {
		log.Errorf("error retrieving user with id %d: %v", userID, err)
		return err
	}
	identity, resp, err := srv.OryClient.IdentityAPI.GetIdentity(ctx, user.KratosID).Execute()
	if err != nil {
		log.Errorf("error fetching identity using id %s: %v", user.KratosID, err)
		return err
	}
	if resp.StatusCode != http.StatusOK {
		log.Errorf("error fetching identity using id %s; status code: %s", user.KratosID, resp.Status)
		return errors.New("error fetching identity")
	}
	traits := identity.GetTraits().(map[string]interface{})
	traits["facility_id"] = transFacilityID
	update := client.UpdateIdentityBody{
		Traits: traits,
	}
	updated, resp, err := srv.OryClient.IdentityAPI.UpdateIdentity(ctx, user.KratosID).UpdateIdentityBody(update).Execute()
	if err != nil {
		log.Errorf("error updating identity with new facility id %d: %v", transFacilityID, err)
		return err
	}
	if resp.StatusCode != http.StatusOK {
		log.Errorf("error updating identity with new facility id %d: %v", transFacilityID, resp.Status)
		return errors.New("failed to update identity")
	}
	log.Infof("Identity updated successfully: %v", updated.GetId())
	return nil
}
