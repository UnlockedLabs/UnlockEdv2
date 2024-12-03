-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.library_favorites
	RENAME COLUMN content_id TO library_id;
ALTER TABLE public.library_favorites
    DROP COLUMN name,
	DROP COLUMN visibility_status,
	DROP COLUMN open_content_url_id,
	DROP COLUMN open_content_provider_id;
ALTER TABLE public.library_favorites ADD COLUMN facility_id INTEGER DEFAULT NULL REFERENCES public.facilities(id);
CREATE UNIQUE INDEX idx_facility_library_user ON library_favorites (library_id, facility_id) WHERE facility_id IS NOT NULL;

ALTER TABLE public.library_favorites ADD CONSTRAINT uni_user_lib_id UNIQUE(user_id, library_id);
ALTER TABLE public.video_favorites ADD CONSTRAINT uni_user_vid_id UNIQUE(user_id, video_id);
ALTER TABLE public.libraries RENAME COLUMN image_url TO thumbnail_url;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.library_favorites RENAME COLUMN library_id TO content_id;
ALTER TABLE public.library_favorites
	ADD COLUMN visibility_status BOOLEAN,
	ADD COLUMN open_content_url_id INTEGER,
	ADD COLUMN name CHARACTER VARYING(255),
	ADD COLUMN open_content_provider_id INTEGER NOT NULL;
ALTER TABLE public.library_favorites DROP CONSTRAINT uni_user_lib_id;
ALTER TABLE public.video_favorites DROP CONSTRAINT uni_user_vid_id;
ALTER TABLE public.libraries RENAME COLUMN thumbnail_url TO image_url;
-- +goose StatementEnd
