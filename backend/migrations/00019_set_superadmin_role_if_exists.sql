-- +goose Up
-- +goose StatementBegin
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.users WHERE id = 1 AND role = 'admin') THEN
        UPDATE public.users
        SET name = 'system_admin'
        WHERE id = 1;
    END IF;
END $$;
-- +goose StatementEnd


-- +goose Down
-- +goose StatementBegin
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.users WHERE id = 1 AND role = 'system_admin') THEN
        UPDATE public.users
        SET role = 'admin'
        WHERE id = 1;
    END IF;
END $$;
-- +goose StatementEnd
