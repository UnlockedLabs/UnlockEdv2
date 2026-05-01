package models

// Classes is zero for class deletes; populated for programs to count classes whose own children block.
// Events and History are informational and never block: scheduled sessions are
// always created with a class, and change-log/history rows are derivative audit
// artifacts. Both are cleaned up alongside the parent on delete.
// NonDeletableStatus is set on class-only checks when the class is in a status
// other than Scheduled (Active/Completed/Cancelled/Paused), which blocks delete.
type DeleteBlockingChildren struct {
	Classes            int64  `json:"classes"`
	Enrollments        int64  `json:"enrollments"`
	Events             int64  `json:"events"`
	Completions        int64  `json:"completions"`
	AttendanceFlags    int64  `json:"attendance_flags"`
	History            int64  `json:"history"`
	NonDeletableStatus string `json:"non_deletable_status,omitempty"`
}

func (b DeleteBlockingChildren) HasAny() bool {
	return b.Classes > 0 ||
		b.Enrollments > 0 ||
		b.Completions > 0 ||
		b.AttendanceFlags > 0 ||
		b.NonDeletableStatus != ""
}
