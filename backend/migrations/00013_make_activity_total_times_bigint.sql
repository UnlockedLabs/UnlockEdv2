-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.activities
    ALTER COLUMN total_time TYPE bigint,
    ALTER COLUMN time_delta TYPE bigint;
-- +goose StatementEnd
-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.activities 
	ALTER COLUMN total_time TYPE integer,
	ALTER COLUMN time_delta TYPE integer;
-- +goose StatementEnd
