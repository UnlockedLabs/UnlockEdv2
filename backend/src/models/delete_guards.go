package models

// Classes is zero for class deletes; populated for programs to count classes whose own children block.
type DeleteBlockingChildren struct {
	Classes         int64 `json:"classes"`
	Enrollments     int64 `json:"enrollments"`
	Events          int64 `json:"events"`
	Completions     int64 `json:"completions"`
	AttendanceFlags int64 `json:"attendance_flags"`
	History         int64 `json:"history"`
}

func (b DeleteBlockingChildren) HasAny() bool {
	return b.Classes > 0 ||
		b.Enrollments > 0 ||
		b.Events > 0 ||
		b.Completions > 0 ||
		b.AttendanceFlags > 0 ||
		b.History > 0
}
