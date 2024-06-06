package handlers

import (
	"UnlockEdv2/src/models"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"

	client "github.com/ory/kratos-client-go"
	log "github.com/sirupsen/logrus"
	"golang.org/x/crypto/bcrypt"
)

func (srv *Server) handleCreateUserKratos(newUser LoginRequest) error {
	identBody := *client.NewCreateIdentityBody("default", map[string]interface{}{
		"username": newUser.Username,
	})
	hashed, err := bcrypt.GenerateFromPassword([]byte(newUser.Password), bcrypt.DefaultCost)
	if err != nil {
		log.Errorf("Error hashing password: %v", err)
		return err
	}
	hashedPassword := string(hashed)
	identBody.SetCredentials(client.IdentityWithCredentials{
		Oidc: nil,
		Password: &client.IdentityWithCredentialsPassword{
			Config: &client.IdentityWithCredentialsPasswordConfig{
				Password:       &newUser.Password,
				HashedPassword: &hashedPassword,
			},
		},
	})

	created, resp, err := srv.OryClient.IdentityAPI.CreateIdentity(context.Background()).CreateIdentityBody(identBody).Execute()
	if err != nil {
		log.Errorf("Error creating identity: %v", err)
		return err
	}
	if resp.StatusCode != http.StatusCreated {
		log.Errorf("Error creating identity: %v", resp.StatusCode)
		return errors.New("error creating identity")
	}
	user := srv.Db.GetUserByUsername(newUser.Username)
	if user == nil {
		log.Error("user not found immediately after creation, this should not happen")
		return errors.New("user not found")
	}
	user.KratosID = created.GetId()
	log.Infof("User created successfully + identity registered with kratos: %v", user.KratosID)
	updated, err := srv.Db.UpdateUser(user)
	if err != nil {
		log.Error("Error updating user")
		return err
	}
	log.Infof("user created successfully + identity registered with kratos: %v", updated)
	return nil
}

func (srv *Server) handleUpdatePasswordKratos(w http.ResponseWriter, user *models.User) {
	client := &http.Client{}
	if user.KratosID == "" {
		log.Debug("User does not have a kratos ID, creating new identity")
		err := srv.handleCreateUserKratos(LoginRequest{Username: user.Username, Password: user.Password})
		if err != nil {
			log.Error("Error creating user in kratos")
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}
		return
	}
	body := map[string]interface{}{}
	body["credentials"] = map[string]interface{}{
		"config": map[string]interface{}{
			"password": user.Password,
		},
	}
	jsonBody, err := json.Marshal(&body)
	if err != nil {
		log.Error("Error marshalling body")
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	req, err := http.NewRequest("PUT", os.Getenv("KRATOS_ADMIN_URL")+"/admin/identities/"+user.KratosID, bytes.NewReader(jsonBody))
	if err != nil {
		log.Error("Error creating request")
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	resp, err := client.Do(req)
	if err != nil {
		log.Error("Error sending request to kratos")
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		log.Error("Error updating password")
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	log.Info("password updated successfully")
}
