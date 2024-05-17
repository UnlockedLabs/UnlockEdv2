package models

type Program struct {
	DatabaseFields
	ProviderPlatformID      uint   `gorm:"not null" json:"provider_platform_id"`
	Name                    string `gorm:"size:60" json:"name"`
	Description             string `gorm:"size:510" json:"description"`
	ExternalID              string `gorm:"size:255" json:"external_id"` // kolibri: root, canvas: course_id
	ThumbnailURL            string `gorm:"size:255" json:"thumbnail_url"`
	IsPublic                bool   `gorm:"default:false" json:"is_public"`
	ExternalURL             string `gorm:"size:255" json:"external_url"`
	AltName                 string `gorm:"size:255" json:"alt_name"`
	TotalProgressMilestones uint   `json:"total_progress_milestones"`

	ProviderPlatform *ProviderPlatform `gorm:"foreignKey:ProviderPlatformID;constraint:OnDelete SET NULL" json:"-"`
	Milestones       []Milestone       `gorm:"foreignKey:ProgramID;constraint:OnDelete SET NULL" json:"-"`
	Outcomes         []Outcome         `gorm:"foreignKey:ProgramID;constraint:OnDelete SET NULL" json:"-"`
}

func (Program) TableName() string {
	return "programs"
}

type RecentActivity struct {
	Date  string `json:"date"`
	Delta uint   `json:"delta"`
}

type CurrentEnrollment struct {
	AltName              string           `json:"alt_name"`
	Name                 string           `json:"name"`
	ProviderPlatformName string           `json:"provider_platform_name"`
	ExternalURL          string           `json:"external_url"`
	TotalActivityTime    []RecentActivity `json:"total_activity_time"`
}

type RecentProgram struct {
	Name                 string `json:"program_name"`
	Progress             string `json:"course_progress"`
	AltName              string `json:"alt_name"`
	ThumbnailURL         string `json:"thumbnail_url"`
	ProviderPlatformName string `json:"provider_platform_name"`
	ExternalURL          string `json:"external_url"`
}

type UserDashboardJoin struct {
	Enrollments    []CurrentEnrollment `json:"enrollments"`
	RecentPrograms [3]RecentProgram    `json:"recent_programs"`
}

type UnlockEdImportProgram struct {
	ProviderPlatformID      int    `json:"provider_platform_id"`
	Name                    string `json:"name"`
	Description             string `json:"description"`
	ExternalID              string `json:"external_id"`
	ThumbnailURL            string `json:"thumbnail_url"`
	IsPublic                bool   `json:"is_public"`
	ExternalURL             string `json:"external_url"`
	TotalProgressMilestones int    `json:"total_progress_milestones"`
}

/*
  https://staging.canvas.unlockedlabs.xyz/api/v1/users/8/courses/98/assignments
get total list ^^^^^ of assignments in the course, which are available to the user
*
*
* COURSE PROGRESS = len(api/v1/courses/{id}/assignments) + len(api/v1/courses/{id}/quizzes)
* SUBMISSIONS =
*
*
*/

/*
 {
"enrollments": [
      {
    "alt_name": "alt_name",
    "name": "name",
    "provider_platform_name": "provider_platform_name",
    "external_url": "external_url",
    "total_activity_time": [
          "date": "date",
          "delta": 1
        ],
      }
     ],
"recent_programs": [
     {
      "program_name": "program_name",
      "course_progress": 1,
      "alt_name": "alt_name",
      "thumbnail_url": "thumbnail_url",
      "provider_platform_name": "provider_platform_name",
      "external_url": "external_url"
     },
     {
      "program_name": "program_name",
      "course_progress": 1,
      "alt_name": "alt_name",
      "thumbnail_url": "thumbnail_url",
      "provider_platform_name": "provider_platform_name",
      "external_url": "external_url"
     },
     {
      "program_name": "program_name",
      "course_progress": 1,
      "alt_name": "alt_name",
      "thumbnail_url": "thumbnail_url",
      "provider_platform_name": "provider_platform_name",
      "external_url": "external_url"
     },
   ]
}

*  User Dashboard Join
*  ProviderPlatform name
*  all program names, for which the user has a milestone of type enrollment + external URL for each
*
*  3 most recent progam names + thumbnail_url + external_url that have acitivty
*  for each of said program, the total activity time for each program in the last 7 days
*
*
*  User Activity: STORE every day, even if there is no user
*
*/
