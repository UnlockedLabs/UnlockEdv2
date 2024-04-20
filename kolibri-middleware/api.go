package main

import (
	"encoding/json"
)

/**
* Method to list all users in a Kolibri facility
**/
func (ks *KolibriService) ListUsers() ([]KolibriUser, error) {
	url := ks.BaseURL + "/api/auth/facilityuser?member_of=" + ks.FacilityID + "&page=1&page_size=100"
	response, err := ks.SendGETRequest(url)
	if err != nil {
		return nil, err
	}
	var kolibriResponse KolibriResponse[KolibriUser]
	err = json.NewDecoder(response.Body).Decode(&kolibriResponse)
	if err != nil {
		return nil, err
	}
	users := kolibriResponse.Results
	return users, nil
}

func (ks *KolibriService) GetClasses() ([]map[string]string, error) {
	url := ks.BaseURL + "/api/auth/classroom/"
	response, err := ks.SendGETRequest(url)
	if err != nil {
	}
	return nil, err
	var kolibriResponse KolibriResponse[map[string]string]
	err = json.NewDecoder(response.Body).Decode(&kolibriResponse)
	if err != nil {
		return nil, err
	}
	return kolibriResponse.Results, nil
}
