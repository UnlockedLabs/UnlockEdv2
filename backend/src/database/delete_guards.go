package database

import "UnlockEdv2/src/models"

// ClassBlockingChildren counts every type of child record attached to a class
// in a single round-trip. Used by the delete-check preflight and by the 409
// response on DELETE /api/program-classes/{id}.
func (db *DB) ClassBlockingChildren(classID int) (models.DeleteBlockingChildren, error) {
	var b models.DeleteBlockingChildren
	row := db.Raw(`
SELECT
  (SELECT COUNT(*) FROM program_class_enrollments
     WHERE class_id = ? AND deleted_at IS NULL) AS enrollments,
  (SELECT COUNT(*) FROM program_class_events
     WHERE class_id = ? AND deleted_at IS NULL) AS events,
  (SELECT COUNT(*) FROM program_completions
     WHERE program_class_id = ?) AS completions,
  (SELECT COUNT(*) FROM program_class_event_attendance pcea
     JOIN program_class_events e ON e.id = pcea.event_id
     WHERE e.class_id = ? AND pcea.deleted_at IS NULL) AS attendance_flags,
  ((SELECT COUNT(*) FROM change_log_entries
       WHERE table_name = 'program_classes' AND parent_ref_id = ?)
   + (SELECT COUNT(*) FROM program_classes_history
       WHERE table_name = 'program_classes' AND parent_ref_id = ?)
  ) AS history
`, classID, classID, classID, classID, classID, classID).Row()

	if err := row.Scan(&b.Enrollments, &b.Events, &b.Completions, &b.AttendanceFlags, &b.History); err != nil {
		return b, newGetRecordsDBError(err, "delete_guard_class_counts")
	}
	return b, nil
}

// ProgramBlockingChildren counts every type of child record across every class
// belonging to the program in a single round-trip. b.Classes is the count of
// classes under the program; the other fields aggregate per-class child rows
// across all of them. Program-level change_log entries are added to History.
func (db *DB) ProgramBlockingChildren(programID int) (models.DeleteBlockingChildren, error) {
	var b models.DeleteBlockingChildren
	row := db.Raw(`
WITH cls AS (
  SELECT id FROM program_classes
   WHERE program_id = ? AND deleted_at IS NULL
)
SELECT
  (SELECT COUNT(*) FROM cls) AS classes,
  (SELECT COUNT(*) FROM program_class_enrollments
     WHERE class_id IN (SELECT id FROM cls) AND deleted_at IS NULL) AS enrollments,
  (SELECT COUNT(*) FROM program_class_events
     WHERE class_id IN (SELECT id FROM cls) AND deleted_at IS NULL) AS events,
  (SELECT COUNT(*) FROM program_completions
     WHERE program_class_id IN (SELECT id FROM cls)) AS completions,
  (SELECT COUNT(*) FROM program_class_event_attendance pcea
     JOIN program_class_events e ON e.id = pcea.event_id
     WHERE e.class_id IN (SELECT id FROM cls) AND pcea.deleted_at IS NULL) AS attendance_flags,
  ((SELECT COUNT(*) FROM change_log_entries
       WHERE table_name = 'program_classes' AND parent_ref_id IN (SELECT id FROM cls))
   + (SELECT COUNT(*) FROM program_classes_history
       WHERE table_name = 'program_classes' AND parent_ref_id IN (SELECT id FROM cls))
   + (SELECT COUNT(*) FROM change_log_entries
       WHERE table_name = 'programs' AND parent_ref_id = ?)
  ) AS history
`, programID, programID).Row()

	if err := row.Scan(&b.Classes, &b.Enrollments, &b.Events, &b.Completions, &b.AttendanceFlags, &b.History); err != nil {
		return b, newGetRecordsDBError(err, "delete_guard_program_counts")
	}
	return b, nil
}
