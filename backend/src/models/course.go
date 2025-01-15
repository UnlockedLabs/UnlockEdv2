package models

import "time"

type Course struct {
	DatabaseFields
	ProviderPlatformID      uint       `gorm:"not null" json:"provider_platform_id"`
	Name                    string     `gorm:"size:60" json:"name"`
	Description             string     `gorm:"size:510" json:"description"`
	ExternalID              string     `gorm:"size:255" json:"external_id"` // kolibri: root, canvas: course_id
	ThumbnailURL            string     `gorm:"size:255" json:"thumbnail_url"`
	Type                    CourseType `gorm:"size:255" json:"type"`
	OutcomeTypes            string     `gorm:"size:255" json:"outcome_types"`
	ExternalURL             string     `gorm:"size:255" json:"external_url"`
	AltName                 string     `gorm:"size:255" json:"alt_name"`
	TotalProgressMilestones uint       `json:"total_progress_milestones"`
	StartDt                 *time.Time `gorm:"type:date" json:"start_dt"`
	EndDt                   *time.Time `gorm:"type:date" json:"end_dt"`

	ProviderPlatform *ProviderPlatform `gorm:"foreignKey:ProviderPlatformID;constraint:OnDelete SET NULL" json:"-"`
	Enrollments      []UserEnrollment  `gorm:"foreignKey:CourseID;constraint:OnDelete SET NULL" json:"-"`
	Milestones       []Milestone       `gorm:"foreignKey:CourseID;constraint:OnDelete SET NULL" json:"-"`
	Outcomes         []Outcome         `gorm:"foreignKey:CourseID;constraint:OnDelete SET NULL" json:"-"`
}

type CourseType string

const (
	OpenEnrollment  CourseType = "open_enrollment"
	OpenContent     CourseType = "open_content"
	FixedEnrollment CourseType = "fixed_enrollment"
)

func (Course) TableName() string {
	return "courses"
}

type UserEnrollment struct {
	UserID     uint       `json:"user_id" gorm:"primaryKey;autoIncrement:false"`
	CourseID   uint       `json:"course_id" gorm:"primaryKey;autoIncrement:false"`
	ExternalID string     `json:"external_id" gorm:"size:64"`
	CreatedAt  *time.Time `json:"created_at"`
	UpdatedAt  *time.Time `json:"updated_at"`
	DeletedAt  *time.Time `json:"deleted_at"`

	User   *User   `json:"user,omitempty" gorm:"foreignKey:UserID;constraint:OnDelete CASCADE"`
	Course *Course `json:"course,omitempty" gorm:"foreignKey:CourseID;constraint:OnDelete CASCADE"`
}

func (UserEnrollment) TableName() string { return "user_enrollments" }

type RecentActivity struct {
	Date  string  `json:"date"`
	Delta float64 `json:"delta"`
}

type LearningInsight struct {
	CourseName            string  `json:"course_name"`
	TotalStudentsEnrolled int64   `json:"total_students_enrolled"`
	CompletionRate        float32 `json:"completion_rate"`
	ActivityHours         int64   `json:"activity_hours"`
}

type AdminLayer2Join struct {
	TotalCoursesOffered   int64             `json:"total_courses_offered"`
	TotalStudentsEnrolled int64             `json:"total_students_enrolled"`
	TotalHourlyActivity   int64             `json:"total_hourly_activity"`
	LearningInsights      []LearningInsight `json:"learning_insights"`
}
