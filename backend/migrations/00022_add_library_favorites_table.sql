-- +goose Up
-- +goose StatementBegin
CREATE TABLE public.library_favorites (
        id SERIAL NOT NULL PRIMARY KEY,
        created_at timestamp with time zone,
        updated_at timestamp with time zone,
        deleted_at timestamp with time zone,
        user_id INTEGER NOT NULL,
        name CHARACTER VARYING(255),
        content_id INTEGER NOT NULL,
        visibility_status BOOLEAN,
        open_content_url_id INTEGER NOT NULL,
        open_content_provider_id INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
        FOREIGN KEY (open_content_provider_id) REFERENCES public.open_content_providers(id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX idx_library_favorites_name ON public.library_favorites USING btree (name);
CREATE INDEX idx_library_favorites_visibility_status ON public.library_favorites USING btree (visibility_status);
CREATE INDEX idx_library_favorites_user_id ON public.library_favorites USING btree (user_id);
CREATE INDEX idx_library_favorites_user_id_open_content_url_id ON public.library_favorites USING btree (user_id, open_content_url_id);

-- +goose StatementEnd
-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS library_favorites CASCADE;
-- +goose StatementEnd


