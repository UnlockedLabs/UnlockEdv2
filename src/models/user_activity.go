package models

type UserActivity struct {
	DatabaseFields
	UserID      uint   `gorm:"not null" json:"user_id"`
	BrowserName string `gorm:"size 255;default:unknown" json:"browser_name"`
	Platform    string `gorm:"size 255;default:unknown" json:"platform"`
	Device      string `gorm:"size 255;default:unknown" json:"device"`
	Ip          string `gorm:"size 255;default:unknown" json:"ip"`
	ClickedUrl  string `gorm:"size 255;default:unknown" json:"clicked_url"`

	User *User `gorm:"foreignKey:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"-"`
}

func (ua UserActivity) TableName() string {
	return "user_activities"
}
