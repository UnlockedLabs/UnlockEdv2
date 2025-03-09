-- +goose Up
-- +goose StatementBegin
CREATE TABLE faqs (
        id SERIAL NOT NULL, 
        question CHARACTER VARYING(255) NOT NULL, 
        PRIMARY KEY (id)
);

CREATE TABLE faq_click_metrics (
        user_id INTEGER NOT NULL, 
        faq_id INTEGER NOT NULL, 
        total BIGINT NOT NULL DEFAULT 1,
        PRIMARY KEY (user_id, faq_id),

        FOREIGN KEY (faq_id) REFERENCES public.faqs(id) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE ON UPDATE CASCADE
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS public.faq_click_metrics CASCADE;
DROP TABLE IF EXISTS public.faqs CASCADE;
-- +goose StatementEnd
