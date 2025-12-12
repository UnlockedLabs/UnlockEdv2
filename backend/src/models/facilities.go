package models

import "time"

type Facility struct {
	DatabaseFields
	Name     string `gorm:"size:255;not null" json:"name"`
	Timezone string `gorm:"size:255;not null" json:"timezone" validate:"timezone"`

	Users              []User               `gorm:"foreignKey:FacilityID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;" json:"-"`
	Programs           []Program            `json:"programs" gorm:"-"`
	FacilitiesPrograms []FacilitiesPrograms `json:"-" gorm:"foreignKey:FacilityID;references:ID"`
	LoginActivity      []LoginActivity      `json:"login_activity" gorm:"foreignKey:FacilityID;constraint:OnDelete CASCADE"`
	Rooms              []Room               `json:"rooms,omitempty" gorm:"foreignKey:FacilityID;references:ID"`
}

func (Facility) TableName() string {
	return "facilities"
}

type Room struct {
	DatabaseFields
	FacilityID uint   `json:"facility_id" gorm:"not null"`
	Name       string `json:"name" gorm:"size:255;not null" validate:"required,max=255"`

	Facility *Facility `json:"facility,omitempty" gorm:"foreignKey:FacilityID;references:ID"`
}

func (Room) TableName() string {
	return "rooms"
}

type RoomBooking struct {
	RoomID     uint
	EventID    uint
	ClassID    uint
	StartTime  time.Time
	EndTime    time.Time
	IsOverride bool
}

type ConflictCheckRequest struct {
	FacilityID     uint
	RoomID         uint
	RecurrenceRule string
	Duration       string
	ExcludeEventID *uint
}

type RoomConflict struct {
	ConflictingEventID uint      `json:"conflicting_event_id"`
	ConflictingClassID uint      `json:"conflicting_class_id"`
	ClassName          string    `json:"class_name"`
	StartTime          time.Time `json:"start_time"`
	EndTime            time.Time `json:"end_time"`
}
