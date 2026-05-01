-- +goose Up
CREATE INDEX IF NOT EXISTS idx_program_completions_program_class_id
    ON public.program_completions (program_class_id);

CREATE INDEX IF NOT EXISTS idx_program_classes_history_table_name_parent_ref_id
    ON public.program_classes_history (table_name, parent_ref_id);

-- +goose Down
DROP INDEX IF EXISTS idx_program_completions_program_class_id;
DROP INDEX IF EXISTS idx_program_classes_history_table_name_parent_ref_id;
