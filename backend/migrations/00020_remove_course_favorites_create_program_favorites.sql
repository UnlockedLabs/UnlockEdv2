-- +goose Up
-- +goose StatementBegin
DROP TABLE IF EXISTS favorites CASCADE;
CREATE TABLE public.program_favorites (
	id SERIAL PRIMARY KEY,
	program_id INT NOT NULL,
	user_id INT NOT NULL,
	FOREIGN KEY (program_id) REFERENCES programs(id),
	FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX program_favorites_program_id_index ON program_favorites USING btree (program_id);
CREATE INDEX program_favorites_user_id_index ON program_favorites USING btree (user_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
CREATE TABLE public.favorites (
    id SERIAL NOT NULL PRIMARY KEY,
    user_id integer,
    course_id integer,
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES public.courses(id) ON UPDATE CASCADE ON DELETE CASCADE
);
DROP TABLE IF EXISTS program_favorites CASCADE;
-- +goose StatementEnd
