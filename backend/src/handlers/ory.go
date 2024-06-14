package handlers

import (
	"UnlockEdv2/src/models"
	"context"
	"errors"
	"net/http"

	client "github.com/ory/kratos-client-go"
	"golang.org/x/crypto/bcrypt"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) handleCreateUserKratos(username, password string) error {
	identity := client.NewCreateIdentityBody("default", map[string]interface{}{"username": username})
	created, resp, err := srv.OryClient.IdentityAPI.CreateIdentity(context.Background()).CreateIdentityBody(*identity).Execute()
	if err != nil {
		log.Errorf("Error creating identity: %v", err)
		return err
	}
	if resp.StatusCode != http.StatusCreated {
		log.Errorf("Error creating identity: %v", resp.StatusCode)
		return errors.New("error creating identity")
	}
	user := srv.Db.GetUserByUsername(username)
	if user == nil {
		log.Error("user not found immediately after creation, this should not happen")
		return errors.New("user not found")
	}
	user.KratosID = created.GetId()
	err = srv.handleUpdatePasswordKratos(user, password)
	if err != nil {
		log.Error("Error updating password for new kratos user")
		return err
	}
	updated, err := srv.Db.UpdateUser(user)
	if err != nil {
		log.Error("Error updating user")
		return err
	}
	log.Infof("user created successfully + identity registered with kratos: %v", updated)
	return nil
}

func (srv *Server) handleUpdatePasswordKratos(user *models.User, password string) error {
	if user.KratosID == "" {
		return errors.New("kratos ID is empty, please create user in kratos first")
	}
	log.Infof("updating password for user: %s and KratosID: %s", user.Username, user.KratosID)
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Errorf("Error hashing password: %v", err)
	}
	hashedPw := string(hashed)
	update := client.UpdateIdentityBody{
		Traits: map[string]interface{}{"username": user.Username},
		Credentials: &client.IdentityWithCredentials{
			Password: &client.IdentityWithCredentialsPassword{
				Config: &client.IdentityWithCredentialsPasswordConfig{
					HashedPassword: &hashedPw,
				},
			},
		},
	}
	updatedIdent, resp, err := srv.OryClient.IdentityAPI.UpdateIdentity(context.Background(), user.KratosID).UpdateIdentityBody(update).Execute()
	if err != nil {
		log.Errorf("Error updating identity with user password: %v", err)
		return err
	}
	if resp.StatusCode != http.StatusOK {
		log.Errorf("Error updating identity with user password: %v", resp.StatusCode)
		return errors.New("error updating identity")
	}
	log.Infof("password updated successfully for user: %s and KratosID: %s", user.Username, updatedIdent.GetId())
	return nil
}
