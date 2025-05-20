-- +goose Up
-- +goose StatementBegin
CREATE TABLE public.change_log_entries (
    id SERIAL NOT NULL PRIMARY KEY,
    table_name VARCHAR(255),
    parent_ref_id INT,
    field_name VARCHAR(150),
    old_value VARCHAR(255),
    new_value VARCHAR(255),
    created_at timestamp with time zone,
    user_id INTEGER NOT NULL,
    
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX idx_change_log_table_name_parent_ref_id on public.change_log_entries (table_name, parent_ref_id);
CREATE INDEX idx_change_log_table_name_parent_ref_id_field_name on public.change_log_entries (table_name, parent_ref_id, field_name);

CREATE UNIQUE INDEX idx_unique_facility_program_active ON public.facilities_programs (program_id, facility_id) WHERE (deleted_at IS NULL);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS public.change_log_entries;

DROP INDEX IF EXISTS idx_unique_facility_program_active;
-- +goose StatementEnd
