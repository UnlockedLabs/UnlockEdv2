-- +goose Up
-- +goose StatementBegin
DROP TABLE IF EXISTS public.program_favorites CASCADE;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS public.program_favorites (id SERIAL NOT NULL, 
program_id INTEGER NOT NULL, 
user_id INTEGER NOT NULL, 
PRIMARY KEY (id), 
CONSTRAINT program_favorites_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id), 
CONSTRAINT program_favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id));
-- +goose StatementEnd
