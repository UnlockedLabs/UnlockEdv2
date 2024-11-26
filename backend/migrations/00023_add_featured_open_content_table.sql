-- +goose Up
-- +goose StatementBegin
CREATE TABLE public.featured_open_content (
        id SERIAL NOT NULL PRIMARY KEY,
        created_at timestamp with time zone,
        updated_at timestamp with time zone,
        deleted_at timestamp with time zone,
        content_id INTEGER NOT NULL,
        facility_id INTEGER NOT NULL,,
        open_content_provider_id INTEGER NOT NULL,
        FOREIGN KEY (open_content_provider_id) REFERENCES public.open_content_providers(id) ON UPDATE CASCADE ON DELETE CASCADE,
        FOREIGN KEY  (facility_id) REFERENCES public.facilities(id) ON UPDATE CASCADE ON DELETE CASCADE,
        UNIQUE(facility_id, content_id, open_content_provider_id)
);

CREATE INDEX idx_library_favorites_facility_id ON public.featured_open_content USING btree (facility_id);
CREATE INDEX idx_library_favorites_facility_id_content_id ON public.featured_open_content USING btree (facility_id, content_id);

-- +goose StatementEnd
-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS featured_open_content CASCADE;
-- +goose StatementEnd


