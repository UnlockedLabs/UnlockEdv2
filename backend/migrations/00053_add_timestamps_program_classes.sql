-- +goose Up
-- +goose StatementBegin
ALTER TABLE program_class_enrollments
ADD COLUMN enrolled_at TIMESTAMP,
ADD COLUMN enrollment_ended_at TIMESTAMP;
UPDATE program_class_enrollments SET enrolled_at = created_at 
WHERE (enrollment_status = 'Enrolled' OR enrollment_status = 'Cancelled' OR enrollment_status = 'Completed' 
OR enrollment_status LIKE 'Incomplete:%')
AND enrolled_at IS NULL;

UPDATE program_class_enrollments SET enrollment_ended_at = updated_at
WHERE (enrollment_status = 'Cancelled' OR enrollment_status = 'Completed' 
OR enrollment_status LIKE 'Incomplete:%')
AND enrollment_ended_at IS NULL;
-- +goose StatementEnd


-- +goose Down
-- +goose StatementBegin
ALTER TABLE program_class_enrollments
DROP COLUMN IF EXISTS enrolled_at,
DROP COLUMN IF EXISTS enrollment_ended_at;
-- +goose StatementEnd
