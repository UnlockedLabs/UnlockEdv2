-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.program_class_event_attendance
    ADD COLUMN IF NOT EXISTS check_in_at VARCHAR(8),
    ADD COLUMN IF NOT EXISTS check_out_at VARCHAR(8),
    ADD COLUMN IF NOT EXISTS minutes_attended INTEGER,
    ADD COLUMN IF NOT EXISTS scheduled_minutes INTEGER;

UPDATE public.program_class_event_attendance AS att
SET
    scheduled_minutes = CEIL(EXTRACT(EPOCH FROM pce.duration::interval) / 60.0)::INTEGER,
    minutes_attended = COALESCE(att.minutes_attended, CEIL(EXTRACT(EPOCH FROM pce.duration::interval) / 60.0)::INTEGER)
FROM public.program_class_events AS pce
WHERE att.event_id = pce.id;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.program_class_event_attendance
    DROP COLUMN IF EXISTS check_in_at,
    DROP COLUMN IF EXISTS check_out_at,
    DROP COLUMN IF EXISTS minutes_attended,
    DROP COLUMN IF EXISTS scheduled_minutes;
-- +goose StatementEnd
