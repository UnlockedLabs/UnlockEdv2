package models

import "time"

type Tag struct {
	ID   uint   `gorm:"primaryKey" json:"key"`
	Name string `gorm:"size:255;not null" json:"value"`
}

func (Tag) TableName() string { return "tags" }

type AuditHistory struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	UserID     *uint     `json:"user_id"`
	AdminID    *uint     `json:"admin_id"`
	TableRef   string    `json:"table_ref"`
	ColumnRef  string    `json:"column_ref"`
	RefID      uint      `json:"ref_id"`
	Action     string    `json:"action"`
	Value      any       `json:"value"`
	FacilityID *uint     `json:"facility_id"`
	CreatedAt  time.Time `json:"created_at"`

	User     *User     `json:"user" gorm:"foreignKey:UserID;references:ID"`
	Admin    *User     `json:"admin" gorm:"foreignKey:AdminID;references:ID"`
	Facility *Facility `json:"facility" gorm:"foreignKey:FacilityID;references:ID"`
}

func (AuditHistory) TableName() string { return "audit_history" }
