-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.program_class_events
    ALTER COLUMN room_id SET NOT NULL;
ALTER TABLE public.program_class_events DROP COLUMN room;
ALTER TABLE public.program_class_event_overrides DROP COLUMN room;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.program_class_events
    ADD COLUMN room VARCHAR(255) DEFAULT 'TBD',
    ALTER COLUMN room_id DROP NOT NULL;
ALTER TABLE public.program_class_event_overrides
    ADD COLUMN room VARCHAR(255);
-- +goose StatementEnd
