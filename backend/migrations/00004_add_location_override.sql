-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.program_section_event_overrides ADD COLUMN location VARCHAR(255);
-- +goose StatementEnd
-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.program_section_event_overrides DROP COLUMN location;
-- +goose StatementEnd


