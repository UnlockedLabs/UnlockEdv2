-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.programs ADD COLUMN program_status bool ;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.programs DROP COLUMN program_status;
-- +goose StatementEnd
