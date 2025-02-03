-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.open_content_favorites DROP CONSTRAINT open_content_favorites_pkey, ADD PRIMARY KEY (id);

ALTER TABLE public.open_content_favorites ADD CONSTRAINT unique_open_content_favorite UNIQUE (content_id, open_content_provider_id, user_id, facility_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.open_content_favorites DROP CONSTRAINT open_content_favorites_pkey, ADD PRIMARY KEY (content_id, open_content_provider_id, user_id);

ALTER TABLE public.open_content_favorites DROP CONSTRAINT unique_open_content_favorite; 
-- +goose StatementEnd
