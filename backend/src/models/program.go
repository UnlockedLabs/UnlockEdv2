package models

type Program struct {
	DatabaseFields
	ProviderPlatformID      uint        `gorm:"not null" json:"provider_platform_id"`
	Name                    string      `gorm:"size:60" json:"name"`
	Description             string      `gorm:"size:510" json:"description"`
	ExternalID              string      `gorm:"size:255" json:"external_id"` // kolibri: root, canvas: course_id
	ThumbnailURL            string      `gorm:"size:255" json:"thumbnail_url"`
	Type                    ProgramType `gorm:"size:255" json:"type"`
	OutcomeTypes            string      `gorm:"size:255" json:"outcome_types"`
	ExternalURL             string      `gorm:"size:255" json:"external_url"`
	AltName                 string      `gorm:"size:255" json:"alt_name"`
	TotalProgressMilestones uint        `json:"total_progress_milestones"`

	ProviderPlatform *ProviderPlatform `gorm:"foreignKey:ProviderPlatformID;constraint:OnDelete SET NULL" json:"-"`
	Milestones       []Milestone       `gorm:"foreignKey:ProgramID;constraint:OnDelete SET NULL" json:"-"`
	Outcomes         []Outcome         `gorm:"foreignKey:ProgramID;constraint:OnDelete SET NULL" json:"-"`
}

type ProgramType string

const (
	OpenEnrollment  ProgramType = "open_enrollment"
	OpenContent     ProgramType = "open_content"
	FixedEnrollment ProgramType = "fixed_enrollment"
)

func (Program) TableName() string {
	return "programs"
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

type RecentProgram struct {
	ProgramName          string `json:"program_name"`
	CourseProgress       string `json:"course_progress"`
	AltName              string `json:"alt_name"`
	ThumbnailUrl         string `json:"thumbnail_url"`
	ProviderPlatformName string `json:"provider_platform_name"`
	ExternalUrl          string `json:"external_url"`
}

type UserDashboardJoin struct {
	Enrollments    []CurrentEnrollment `json:"enrollments"`
	RecentPrograms [3]RecentProgram    `json:"recent_programs"`
	WeekActivity   []RecentActivity    `json:"week_activity"`
}

type ImportProgram struct {
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

//ADMIN STRUCTS

type AdminDashboardJoin struct {
	FacilityName        string               `json:"facility_name"`
	MonthlyActivity     []RecentActivity     `json:"monthly_activity"`
	WeeklyActiveUsers   uint                 `json:"weekly_active_users"`
	AvgDailyActivity    uint                 `json:"avg_daily_activity"`
	TotalWeeklyActivity uint                 `json:"total_weekly_activity"`
	ProgramMilestones   [5]ProgramMilestones `json:"program_milestones"`
	TopProgramActivity  [5]ProgramActivity   `json:"top_program_activity"`
}

type ProgramMilestones struct {
	CombinedName string `json:"combined_name"`
	Milestones   int    `json:"milestones"`
}

type ProgramActivity struct {
	ProgramName  string  `json:"program_name"`
	AltName      string  `json:"alt_name"`
	HoursEngaged float32 `json:"hours_engaged"`
}
