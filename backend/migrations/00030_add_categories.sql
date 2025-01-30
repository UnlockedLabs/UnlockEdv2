-- +goose Up
-- +goose StatementBegin
CREATE TABLE public.open_content_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);
CREATE INDEX idx_open_content_categories_name ON public.open_content_categories USING btree(name);

CREATE TABLE public.open_content_types (
    category_id integer NOT NULL,
    content_id integer NOT NULL,
    open_content_provider_id integer NOT NULL,
    PRIMARY KEY (category_id, content_id, open_content_provider_id) 
);

INSERT INTO open_content_categories (name) VALUES 
('Adult Basic Education'),
('Higher Education'),
('Vocational'),
('Rehabilitative'),
('Life Skills'),
('Therapeutic');

-- +goose StatementEnd
-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS public.open_content_categories CASCADE; 
DROP TABLE IF EXISTS public.open_content_types CASCADE;
-- +goose StatementEnd


