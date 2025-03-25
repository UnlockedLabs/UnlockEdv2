-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.users ADD COLUMN doc_id VARCHAR(32);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.users DROP COLUMN doc_id;
-- +goose StatementEnd
