-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.program_class_enrollments ADD COLUMN change_reason VARCHAR(250);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.program_class_enrollments DROP COLUMN change_reason;
-- +goose StatementEnd
