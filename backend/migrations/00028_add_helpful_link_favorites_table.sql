-- +goose Up
-- +goose StatementBegin
CREATE TABLE public.helpful_link_favorites (
        id SERIAL NOT NULL PRIMARY KEY,
        created_at timestamp with time zone,
        updated_at timestamp with time zone,
        deleted_at timestamp with time zone,
        user_id INTEGER NOT NULL,
        content_id INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
        FOREIGN KEY (content_id) REFERENCES public.helpful_links(id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX idx_helpful_link_favorites_user_id ON public.helpful_link_favorites USING btree (user_id);
CREATE INDEX idx_helpful_link_favorites_content_id ON public.helpful_link_favorites USING btree (content_id);

-- +goose StatementEnd
-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS helpful_link_favorites CASCADE;
-- +goose StatementEnd


