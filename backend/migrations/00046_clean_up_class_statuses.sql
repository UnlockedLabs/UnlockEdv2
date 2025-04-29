-- +goose Up
-- +goose StatementBegin
UPDATE program_classes SET status = 'Scheduled' WHERE status = 'Pending';

CREATE TYPE public.class_status AS ENUM (
    'Scheduled',
    'Active',
    'Cancelled',
    'Completed',
    'Paused'
);

ALTER TABLE program_classes ALTER COLUMN status TYPE TEXT;
ALTER TABLE program_classes ALTER COLUMN status TYPE class_status USING status::class_status;
DROP TYPE IF EXISTS public.section_status;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE program_classes ALTER COLUMN status TYPE TEXT;

CREATE TYPE public.section_status AS ENUM (
    'Scheduled',
    'Active',
    'Cancelled',
    'Completed',
    'Paused',
    'Pending'
);

ALTER TABLE program_classes ALTER COLUMN status TYPE section_status USING status::section_status;
DROP TYPE IF EXISTS public.class_status;
-- +goose StatementEnd
