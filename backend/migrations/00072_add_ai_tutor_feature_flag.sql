-- +goose Up
-- +goose NO TRANSACTION
ALTER TYPE feature ADD VALUE IF NOT EXISTS 'ai_tutor';

INSERT INTO public.feature_flags (name, enabled)
VALUES ('ai_tutor', FALSE)
ON CONFLICT (name) DO NOTHING;

-- +goose Down
DELETE FROM public.feature_flags WHERE name = 'ai_tutor';
