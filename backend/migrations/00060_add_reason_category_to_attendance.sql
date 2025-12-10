-- +goose Up
ALTER TABLE public.program_class_event_attendance ADD COLUMN reason_category text DEFAULT '';

-- +goose Down
ALTER TABLE public.program_class_event_attendance DROP COLUMN reason_category;
