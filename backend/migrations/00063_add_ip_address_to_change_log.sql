-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.change_log_entries ADD COLUMN ip_address VARCHAR(45);
COMMENT ON COLUMN public.change_log_entries.ip_address IS 'IP address of the user who made the change for forensic investigation';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.change_log_entries DROP COLUMN IF EXISTS ip_address;
-- +goose StatementEnd

