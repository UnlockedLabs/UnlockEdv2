-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.program_completions ADD COLUMN IF NOT EXISTS enrolled_on_dt TIMESTAMP WITHOUT TIME ZONE NULL;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.program_completions DROP COLUMN IF EXISTS enrolled_on_dt;
-- +goose StatementEnd
