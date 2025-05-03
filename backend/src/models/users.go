package models

import (
	"math/rand"
	"slices"
	"time"

	"gorm.io/gorm"
)

type UserRole string

const (
	SystemAdmin     UserRole = "system_admin"
	FacilityAdmin   UserRole = "facility_admin"
	DepartmentAdmin UserRole = "department_admin"
	Student         UserRole = "student"
)

var AdminRoles = []UserRole{SystemAdmin, FacilityAdmin, DepartmentAdmin}

type DatabaseFields struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

type Role struct {
	Name UserRole `json:"name" gorm:"primaryKey"`
}

type User struct {
	DatabaseFields
	Username   string   `gorm:"size:255;not null;unique" json:"username" validate:"alphanumunicode"`
	NameFirst  string   `gorm:"size:255;not null" json:"name_first"  validate:"alphanumspace"`
	Email      string   `gorm:"size:255;not null;unique" json:"email" validate:"-"`
	NameLast   string   `gorm:"size:255;not null" json:"name_last"  validate:"alphanumspace"`
	Role       UserRole `gorm:"size:64;default:student" json:"role" validate:"oneof=student system_admin facility_admin department_admin"`
	KratosID   string   `gorm:"size:255" json:"kratos_id"`
	FacilityID uint     `json:"facility_id"`
	DocID      string   `json:"doc_id" gorm:"column:doc_id;size:25"`

	/* foreign keys */
	Mappings             []ProviderUserMapping `json:"mappings,omitempty" gorm:"foreignKey:UserID;constraint:OnDelete CASCADE"`
	Enrollments          []UserEnrollment      `json:"enrollments,omitempty" gorm:"foreignKey:UserID;constraint:OnDelete CASCADE"`
	OpenContentFavorites []OpenContentFavorite `json:"favorites,omitempty" gorm:"foreignKey:UserID;constraint:OnDelete CASCADE"`
	Facility             *Facility             `json:"facility,omitempty" gorm:"foreignKey:FacilityID;constraint:OnDelete SET NULL"`
	UserRole             *Role                 `json:"-" gorm:"foreignKey:Role;constraint:OnDelete SET NULL"`
	LoginCount           *LoginMetrics         `json:"login_count,omitempty" gorm:"foreignKey:UserID;constraint:OnDelete CASCADE"`
}

type ImportUser struct {
	Username         string `json:"username"`
	NameFirst        string `json:"name_first"`
	NameLast         string `json:"name_last"`
	Email            string `json:"email"`
	ExternalUserID   string `json:"external_user_id"`
	ExternalUsername string `json:"external_username"`
}

func (User) TableName() string {
	return "users"
}

func (usr *User) BeforeCreate(tx *gorm.DB) error {
	if usr.Email == "" {
		usr.Email = usr.Username + "@unlocked.v2"
	}
	return nil
}

const letterBytes = "abcdefghijklmnopqrstuvwxyz"

func (user *User) CreateTempPassword() string {
	b := make([]byte, 8)
	for i := range b {
		b[i] = letterBytes[rand.Intn(len(letterBytes))]
	}
	return string(b)
}

func (user *User) GetTraits() map[string]any {
	return map[string]any{
		"username":    user.Username,
		"role":        user.Role,
		"facility_id": user.FacilityID,
	}
}

func (user *User) IsAdmin() bool {
	return slices.Contains(AdminRoles, user.Role)
}

type UserAccountHistory struct {
	UserID                  uint                  `json:"user_id" gorm:"primaryKey"`
	AdminID                 *uint                 `json:"admin_id"`
	Action                  ActivityHistoryAction `json:"action" gorm:"size:255;primaryKey"`
	ProgramClassesHistoryID *uint                 `json:"program_classes_history_id"`
	FacilityID              *uint                 `json:"facility_id"`
	CreatedAt               time.Time             `json:"created_at" gorm:"primaryKey"`

	User                  *User                  `json:"user,omitempty" gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE"`
	Admin                 *User                  `json:"admin,omitempty" gorm:"foreignKey:AdminID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE"`
	ProgramClassesHistory *ProgramClassesHistory `json:"program_classes_history,omitempty" gorm:"foreignKey:ProgramClassesHistoryID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE"`
	Facility              *Facility              `json:"facility,omitempty" gorm:"foreignKey:FacilityID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE"`
}

func (UserAccountHistory) TableName() string {
	return "user_account_history"
}

type ActivityHistoryAction string

const (
	AccountCreation  ActivityHistoryAction = "account_creation"
	FacilityTransfer ActivityHistoryAction = "facility_transfer"
	SetPassword      ActivityHistoryAction = "set_password"
	ResetPassword    ActivityHistoryAction = "reset_password"
	PrgClassHistory  ActivityHistoryAction = "prgcls_history"
)

type ActivityHistoryResponse struct {
	Action                  ActivityHistoryAction `json:"action"`
	CreatedAt               time.Time             `json:"created_at"`
	FieldName               string                `json:"field_name"`
	NewValue                string                `json:"new_value"`
	UserID                  uint                  `json:"user_id"`
	UserUsername            string                `json:"user_username"`
	AdminUsername           *string               `json:"admin_username"`
	FacilityName            *string               `json:"facility_name"`
	ProgramClassesHistoryID *uint                 `json:"program_classes_history_id"`

	ProgramClassesHistory *ProgramClassesHistory `json:"program_classes_history,omitempty" gorm:"foreignKey:ProgramClassesHistoryID;constraint:OnDelete:SET NULL"`
}

func NewUserAccountHistory(userID uint, action ActivityHistoryAction, adminID *uint, programClassesHistoryID *uint, facilityID *uint) *UserAccountHistory {
	return &UserAccountHistory{
		UserID:                  userID,
		AdminID:                 adminID,
		Action:                  action,
		ProgramClassesHistoryID: programClassesHistoryID,
		FacilityID:              facilityID,
		CreatedAt:               time.Now(),
	}
}

type ResidentProgramClassInfo struct {
	ProgramName          string                  `json:"program_name"`
	ClassName            string                  `json:"class_name"`
	Status               ClassStatus             `json:"status"`
	EnrollmentStatus     ProgramEnrollmentStatus `json:"enrollment_status"`
	StartDate            string                  `json:"start_date"`
	EndDate              string                  `json:"end_date"`
	AttendancePercentage string                  `json:"attendance_percentage"`
	ClassID              uint                    `json:"class_id" `
	ProgramID            uint                    `json:"program_id"`
	PresentAttendance    int                     `json:"present_attendance"`
	AbsentAttendance     int                     `json:"absent_attendance"`
	CreditType           string                  `json:"credit_type"`
}
