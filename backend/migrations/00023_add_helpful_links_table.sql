-- +goose Up
-- +goose StatementBegin
CREATE TABLE public.helpful_links (
    id SERIAL NOT NULL PRIMARY KEY,
    created_at timestamp with time zone, 
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone, 
    title CHARACTER VARYING(255) NOT NULL,
    url CHARACTER VARYING(255) NOT NULL,
    facility_id integer,
    open_content_provider_id integer,

    FOREIGN KEY (facility_id) REFERENCES public.facilities(id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (open_content_provider_id) REFERENCES public.open_content_providers(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX idx_helpful_links_facility_id ON public.helpful_links USING btree (facility_id);
CREATE INDEX idx_helpful_links_title ON public.helpful_links USING btree (title);
-- +goose StatementEnd
-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS public.helpful_links CASCADE;
DROP TABLE IF EXISTS public.left_menu_links CASCADE;
-- +goose StatementEnd


