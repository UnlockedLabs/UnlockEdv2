-- +goose Up
-- +goose StatementBegin
DROP TABLE IF EXISTS public.user_account_history CASCADE;
CREATE TABLE public.audit_history (
        id SERIAL NOT NULL PRIMARY KEY,
        user_id INTEGER,
        admin_id INTEGER,
        table_ref CHARACTER VARYING(128),
        column_ref CHARACTER VARYING(128),
        ref_id INTEGER,
        action CHARACTER VARYING(32),
        value TEXT,
        facility_id INTEGER,
        created_at timestamp with time zone,

        FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
		FOREIGN KEY (admin_id) REFERENCES public.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (facility_id) REFERENCES public.facilities(id) ON DELETE CASCADE ON UPDATE CASCADE
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS public.audit_history CASCADE;
CREATE TABLE IF NOT EXISTS public.user_account_history (
        id SERIAL NOT NULL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        admin_id INTEGER,
        action CHARACTER VARYING(255) NOT NULL,
        program_classes_history_id INTEGER,
        facility_id INTEGER,
        created_at timestamp with time zone,

        FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
		FOREIGN KEY (admin_id) REFERENCES public.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (program_classes_history_id) REFERENCES public.program_classes_history(id) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (facility_id) REFERENCES public.facilities(id) ON DELETE CASCADE ON UPDATE CASCADE
);
-- +goose StatementEnd
