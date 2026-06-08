-- +goose Up
ALTER TABLE public.provider_platforms ADD COLUMN IF NOT EXISTS enrollment_types text NULL;

-- +goose Down
ALTER TABLE public.provider_platforms DROP COLUMN IF EXISTS enrollment_types;
