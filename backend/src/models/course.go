package models

type Course struct {
	DatabaseFields
	ProviderPlatformID      uint              `gorm:"not null" json:"provider_platform_id"`
	Name                    string            `gorm:"size:60" json:"name"`
	Description             string            `gorm:"size:510" json:"description"`
	ExternalID              string            `gorm:"size:255" json:"external_id"` // kolibri: root, canvas: course_id
	ThumbnailURL            string            `gorm:"size:255" json:"thumbnail_url"`
	Type                    CourseType        `gorm:"size:255" json:"type"`
	OutcomeTypes            string            `gorm:"size:255" json:"outcome_types"`
	ExternalURL             string            `gorm:"size:255" json:"external_url"`
	AltName                 string            `gorm:"size:255" json:"alt_name"`
	TotalProgressMilestones uint              `json:"total_progress_milestones"`
	ProviderPlatform        *ProviderPlatform `gorm:"foreignKey:ProviderPlatformID;constraint:OnDelete SET NULL" json:"-"`
	Milestones              []Milestone       `gorm:"foreignKey:CourseID;constraint:OnDelete SET NULL" json:"-"`
	Outcomes                []Outcome         `gorm:"foreignKey:CourseID;constraint:OnDelete SET NULL" json:"-"`
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

type RecentActivity struct {
	Date  string  `json:"date"`
	Delta float32 `json:"delta"`
}

type CurrentEnrollment struct {
	AltName              string `json:"alt_name"`
	Name                 string `json:"name"`
	ProviderPlatformName string `json:"provider_platform_name"`
	ExternalURL          string `json:"external_url"`
	TotalTime            uint   `json:"total_activity_time"`
}

type RecentCourse struct {
	CourseName           string `json:"course_name"`
	CourseProgress       string `json:"course_progress"`
	AltName              string `json:"alt_name"`
	ThumbnailUrl         string `json:"thumbnail_url"`
	ProviderPlatformName string `json:"provider_platform_name"`
	ExternalUrl          string `json:"external_url"`
}

type UserDashboardJoin struct {
	Enrollments   []CurrentEnrollment `json:"enrollments"`
	RecentCourses []RecentCourse      `json:"recent_courses"`
	TopCourses    []string            `json:"top_courses"`
	WeekActivity  []RecentActivity    `json:"week_activity"`
}

type ImportCourse struct {
	ProviderPlatformID      int      `json:"provider_platform_id"`
	Name                    string   `json:"name"`
	Description             string   `json:"description"`
	ExternalID              string   `json:"external_id"`
	ThumbnailURL            string   `json:"thumbnail_url"`
	Type                    string   `json:"type"`
	OutcomeTypes            []string `json:"outcome_types"`
	ExternalURL             string   `json:"external_url"`
	TotalProgressMilestones int      `json:"total_progress_milestones"`
}

// ADMIN STRUCTS
type AdminDashboardJoin struct {
	FacilityName        string             `json:"facility_name"`
	MonthlyActivity     []RecentActivity   `json:"monthly_activity"`
	WeeklyActiveUsers   uint               `json:"weekly_active_users"`
	AvgDailyActivity    uint               `json:"avg_daily_activity"`
	TotalWeeklyActivity uint               `json:"total_weekly_activity"`
	CourseMilestones    []CourseMilestones `json:"course_milestones"`
	TopCourseActivity   []CourseActivity   `json:"top_course_activity"`
}

type CourseMilestones struct {
	Name       string `json:"name"`
	Milestones int    `json:"milestones"`
}

type CourseActivity struct {
	CourseName   string  `json:"course_name"`
	AltName      string  `json:"alt_name"`
	HoursEngaged float32 `json:"hours_engaged"`
}
