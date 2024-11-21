-- +goose Up
-- +goose StatementBegin
CREATE TABLE open_content_urls (
        id SERIAL NOT NULL, 
        content_url CHARACTER VARYING(255) NOT NULL, 
        PRIMARY KEY (id)
);

CREATE TABLE open_content_activities (
        id SERIAL NOT NULL, 
        request_ts TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
        open_content_provider_id INTEGER NOT NULL, 
        facility_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL, 
        content_id INTEGER NOT NULL, 
        open_content_url_id INTEGER NOT NULL, 
        PRIMARY KEY (id), 

        CONSTRAINT open_content_activities_open_content_provider_id_fkey FOREIGN KEY (open_content_provider_id) REFERENCES "open_content_providers" ("id") ON DELETE CASCADE ON UPDATE CASCADE, 
        CONSTRAINT open_content_activities_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES "facilities" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT open_content_activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE, 
        CONSTRAINT open_content_activities_open_content_url_id_fkey FOREIGN KEY (open_content_url_id) REFERENCES "open_content_urls" ("id") ON DELETE CASCADE ON UPDATE CASCADE, 
        CONSTRAINT unique_user_facility_library_url_timestamp UNIQUE (user_id, facility_id, content_id, open_content_url_id, request_ts)
);

CREATE INDEX idx_open_content_activities_user_id ON public.open_content_activities USING btree (user_id);
CREATE INDEX idx_open_content_activities_open_content_url_id ON public.open_content_activities USING btree (open_content_url_id);
CREATE INDEX idx_open_content_activities_user_id_content_id_facility_id ON public.open_content_activities USING btree (user_id, content_id, facility_id);
CREATE INDEX idx_open_content_activities_content_id_open_content_provider_id_facility_id ON public.open_content_activities USING btree (content_id, open_content_provider_id, facility_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS open_content_activities CASCADE;
DROP TABLE IF EXISTS open_content_urls CASCADE;
-- +goose StatementEnd
