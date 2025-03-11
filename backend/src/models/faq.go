package models

type FAQClickMetric struct {
	UserID uint  `gorm:"not null" json:"user_id"`
	FAQID  uint  `gorm:"not null" json:"faq_id"`
	Total  int64 `gorm:"default:1" json:"total"`

	User *User `gorm:"foreignKey:UserID;references:ID" json:"-"`
	FAQ  *FAQ  `gorm:"foreignKey:FAQID;references:ID" json:"-"`
}

func (FAQClickMetric) TableName() string { return "faq_click_metrics" }

type FAQ struct {
	ID       uint   `gorm:"primaryKey" json:"-"`
	Question string `gorm:"size:255" json:"question"`
}

func (FAQ) TableName() string { return "faqs" }
