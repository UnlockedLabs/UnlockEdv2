-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.program_section_event_attendance ADD CONSTRAINT unique_program_section_event_attendance UNIQUE (user_id, event_id, date);
-- +goose StatementEnd
-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.program_section_event_attendance DROP CONSTRAINT unique_program_section_event_attendance;
-- +goose StatementEnd


