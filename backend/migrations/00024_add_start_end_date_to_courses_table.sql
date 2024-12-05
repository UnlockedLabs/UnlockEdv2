-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.courses ADD COLUMN start_dt date;
ALTER TABLE public.courses ADD COLUMN end_dt date;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.courses DROP COLUMN start_dt;
ALTER TABLE public.courses DROP COLUMN end_dt;
-- +goose StatementEnd
