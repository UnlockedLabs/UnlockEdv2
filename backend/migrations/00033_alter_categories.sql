-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.open_content_categories RENAME TO tags;
ALTER TABLE public.open_content_types RENAME TO open_content_tags;
ALTER TABLE open_content_tags RENAME COLUMN category_id TO tag_id;
DROP TABLE IF EXISTS public.program_tags;
CREATE TABLE public.program_tags (
    tag_id integer NOT NULL,
    program_id integer NOT NULL,
    facility_id integer NOT NULL,
    PRIMARY KEY (tag_id, program_id, facility_id) 
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.open_content_tags RENAME TO open_content_types;
ALTER TABLE public.tags RENAME TO open_content_categories;
DROP TABLE IF EXISTS public.program_tags;
CREATE TABLE public.program_tags (
    id SERIAL PRIMARY KEY,
	program_id integer NOT NULL,
    value VARCHAR(255) NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
	FOREIGN KEY (program_id) REFERENCES programs(id)
);
-- +goose StatementEnd
