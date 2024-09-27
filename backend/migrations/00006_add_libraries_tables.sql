-- +goose Up
-- +goose StatementBegin
CREATE TABLE public.libraries (
    id SERIAL PRIMARY KEY,
    open_content_provider_id integer NOT NULL,
    external_id VARCHAR,
    name VARCHAR(255) NOT NULL,
    language VARCHAR(255),
    description TEXT,
    url VARCHAR NOT NULL,
    image_url VARCHAR,
    visibility_status BOOLEAN NOT NULL DEFAULT false,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    FOREIGN KEY (open_content_provider_id) REFERENCES open_content_providers(id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX idx_libraries_deleted_at ON public.libraries USING btree (id);
CREATE INDEX idx_libraries_open_content_provider_id ON public.libraries USING btree (open_content_provider_id);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE public.libraries CASCADE;
-- +goose StatementEnd
