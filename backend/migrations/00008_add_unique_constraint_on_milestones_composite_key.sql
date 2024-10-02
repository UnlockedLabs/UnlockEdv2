-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.milestones ADD CONSTRAINT unique_extern_id_course_id UNIQUE (external_id, course_id, user_id);
-- +goose StatementEnd
-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.milestones DROP CONSTRAINT unique_extern_id_course_id;
-- +goose StatementEnd


