-- +goose Up
ALTER TABLE program_class_event_attendance ADD COLUMN reason_category text DEFAULT '';

-- +goose Down
ALTER TABLE program_class_event_attendance DROP COLUMN reason_category;
