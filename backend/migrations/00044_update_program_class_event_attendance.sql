-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.program_class_event_attendance ADD COLUMN note VARCHAR(150);
CREATE UNIQUE INDEX idx_event_user_date ON public.program_class_event_attendance (event_id, user_id, date);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.program_class_event_attendance DROP COLUMN note;
DROP INDEX idx_event_user_date;
-- +goose StatementEnd
