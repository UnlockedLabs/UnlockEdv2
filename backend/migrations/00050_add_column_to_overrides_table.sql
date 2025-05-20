-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.program_class_event_overrides ADD COLUMN reason VARCHAR(255);
ALTER TABLE public.program_class_event_overrides RENAME COLUMN location TO room;
ALTER TABLE public.program_class_event_overrides ADD CONSTRAINT unique_event_id_rrule UNIQUE (event_id, override_rrule);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.program_class_event_overrides DROP COLUMN reason ;
ALTER TABLE public.program_class_event_overrides RENAME COLUMN room TO location;
ALTER TABLE public.program_class_event_overrides DROP CONSTRAINT IF EXISTS unique_event_id_rrule;
-- +goose StatementEnd
