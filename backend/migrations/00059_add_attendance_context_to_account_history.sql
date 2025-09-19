-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.user_account_history 
ADD COLUMN attendance_status VARCHAR(27),
ADD COLUMN class_name VARCHAR(255),
ADD COLUMN session_date DATE;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.user_account_history 
DROP COLUMN IF EXISTS attendance_status,
DROP COLUMN IF EXISTS class_name,
DROP COLUMN IF EXISTS session_date;
-- +goose StatementEnd
