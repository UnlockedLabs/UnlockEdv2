-- +goose Up
-- +goose StatementBegin
ALTER TABLE courses ALTER COLUMN name TYPE character varying(255);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE courses ALTER COLUMN name TYPE character varying (60);
-- +goose StatementEnd
