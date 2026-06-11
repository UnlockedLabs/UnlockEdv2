-- +goose Up
-- +goose NO TRANSACTION
ALTER TYPE feature ADD VALUE IF NOT EXISTS 'learning_record';

INSERT INTO public.feature_flags (name, enabled)
VALUES ('learning_record', FALSE)
ON CONFLICT (name) DO NOTHING;

-- +goose Down
DELETE FROM public.feature_flags WHERE name = 'learning_record';
