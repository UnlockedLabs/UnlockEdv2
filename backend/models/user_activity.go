package models

type UserActivity struct {
	UserID      int    `json:"user_id"`
	BrowserName string `json:"browser_name"`
	Platform    string `json:"platform"`
	Device      string `json:"device"`
	Ip          string `json:"ip"`
	ClickedUrl  string `json:"clicked_url"`
}
