-- +goose Up
-- +goose StatementBegin
CREATE TABLE public.facility_visibility_statuses (
    facility_id INTEGER NOT NULL,
    open_content_provider_id INTEGER NOT NULL,
    content_id INTEGER NOT NULL,
    visibility_status boolean NOT NULL DEFAULT false,
    PRIMARY KEY (facility_id, open_content_provider_id, content_id),

    FOREIGN KEY (facility_id) REFERENCES public.facilities(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (open_content_provider_id) REFERENCES open_content_providers(id) ON DELETE CASCADE ON UPDATE CASCADE
);
ALTER TABLE public.libraries DROP COLUMN visibility_status;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS public.facility_visibility_statuses CASCADE;
ALTER TABLE public.libraries ADD COLUMN visibility_status BOOLEAN;
-- +goose StatementEnd