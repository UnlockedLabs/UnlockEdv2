-- +goose Up
-- +goose StatementBegin
ALTER TABLE program_class_enrollments
ADD COLUMN enrolled_at TIMESTAMP,
ADD COLUMN enrollment_ended_at TIMESTAMP;
-- +goose StatementEnd


-- +goose Down
-- +goose StatementBegin
ALTER TABLE program_class_enrollments
DROP COLUMN IF EXISTS enrolled_at,
DROP COLUMN IF EXISTS enrollment_ended_at;
-- +goose StatementEnd
