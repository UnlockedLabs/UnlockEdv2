-- +goose Up
-- +goose StatementBegin
ALTER TABLE users DROP COLUMN password;
ALTER TABLE users DROP COLUMN password_reset;
-- +goose StatementEnd
-- +goose Down
-- +goose StatementBegin
ALTER TABLE users ADD COLUMN password character varying(255);
ALTER TABLE users ADD COLUMN password_reset boolean;
-- +goose StatementEnd


