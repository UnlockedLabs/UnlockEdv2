-- +goose Up
-- +goose StatementBegin
INSERT INTO public.page_feature_flags (feature_flag_id, page_feature, enabled, created_at)
select id, 'request_content', TRUE, now()
from public.feature_flags WHERE name = 'open_content';

INSERT INTO public.page_feature_flags (feature_flag_id, page_feature, enabled, created_at)
select id, 'helpful_links', TRUE, now()
from public.feature_flags WHERE name = 'open_content';

INSERT INTO public.page_feature_flags (feature_flag_id, page_feature, enabled, created_at)
select id, 'upload_video', TRUE, now()
from public.feature_flags WHERE name = 'open_content';

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- +goose StatementEnd
