-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.programs ADD COLUMN is_active bool;
ALTER TABLE public.users ADD COLUMN doc_id VARCHAR(32);
ALTER TABLE public.program_sections DROP COLUMN duration;
ALTER TABLE public.program_sections ADD COLUMN end_dt DATE;
CREATE INDEX idx_programs_is_active ON public.programs (is_active);
CREATE INDEX idx_program_sections_end_dt ON public.program_sections (end_dt);
CREATE INDEX idx_users_doc_id ON public.users (doc_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.programs DROP COLUMN is_active;
ALTER TABLE public.program_sections ADD COLUMN duration INTERVAL;
ALTER TABLE public.program_sections DROP COLUMN end_dt;
ALTER TABLE public.users DROP COLUMN doc_id;
DROP INDEX IF EXISTS idx_programs_is_active;
DROP INDEX IF EXISTS idx_program_sections_end_dt;
DROP INDEX IF EXISTS idx_users_doc_id;
-- +goose StatementEnd
