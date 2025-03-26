-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.open_content_categories RENAME TO tags;
ALTER TABLE public.open_content_types RENAME TO open_content_tags;
ALTER TABLE public.open_content_tags RENAME COLUMN category_id TO tag_id;
ALTER TABLE public.open_content_tags ADD FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE;
ALTER TABLE public.open_content_tags ADD FOREIGN KEY (open_content_provider_id) REFERENCES open_content_providers(id) ON DELETE CASCADE;
DROP TABLE IF EXISTS public.program_tags;
CREATE TABLE public.program_tags (
    tag_id integer NOT NULL,
    program_id integer NOT NULL,
    facility_id integer NOT NULL,
    PRIMARY KEY (tag_id, program_id, facility_id),
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE,
    FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.open_content_tags DROP CONSTRAINT open_content_tags_tag_id_fkey;
ALTER TABLE public.open_content_tags DROP CONSTRAINT open_content_tags_open_content_provider_id_fkey;
ALTER TABLE public.open_content_tags RENAME COLUMN tag_id TO category_id;
ALTER TABLE public.open_content_tags RENAME TO open_content_types;
ALTER TABLE public.tags RENAME TO open_content_categories;
DROP TABLE IF EXISTS public.program_tags;
CREATE TABLE public.program_tags (
    id SERIAL PRIMARY KEY,
	program_id integer NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    value VARCHAR(255) NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone
);
-- +goose StatementEnd
