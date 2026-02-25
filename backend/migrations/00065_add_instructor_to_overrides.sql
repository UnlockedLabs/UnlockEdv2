-- +goose Up
ALTER TABLE program_class_event_overrides
  ADD COLUMN instructor_id INTEGER REFERENCES users(id);

-- +goose Down
ALTER TABLE program_class_event_overrides DROP COLUMN IF EXISTS instructor_id;
