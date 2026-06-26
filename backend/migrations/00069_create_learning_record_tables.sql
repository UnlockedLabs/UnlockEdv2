-- +goose Up
-- +goose NO TRANSACTION
CREATE TABLE public.learning_record_entries (
    id                    SERIAL PRIMARY KEY,
    user_id               INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    client_id             TEXT NOT NULL,
    is_draft              BOOLEAN NOT NULL DEFAULT FALSE,
    step_index            INTEGER NOT NULL DEFAULT 0,
    ui_phase              TEXT NOT NULL DEFAULT 'survey',
    editing_entry_id      INTEGER REFERENCES public.learning_record_entries(id) ON DELETE SET NULL,
    program_name          TEXT NOT NULL DEFAULT '',
    completion_date       TEXT NOT NULL DEFAULT '',
    confidence            TEXT NOT NULL DEFAULT '',
    summary               TEXT NOT NULL DEFAULT '',
    top_skills            TEXT NOT NULL DEFAULT '[]',
    barrier_to_completion TEXT NOT NULL DEFAULT '',
    goal_connection       TEXT NOT NULL DEFAULT '',
    pride                 TEXT NOT NULL DEFAULT '',
    standout_moment       TEXT NOT NULL DEFAULT '',
    advice_to_peer        TEXT NOT NULL DEFAULT '',
    challenge_toggle      TEXT,
    challenge_text        TEXT NOT NULL DEFAULT '',
    skill_tags_before     TEXT NOT NULL DEFAULT '[]',
    skill_tags_after      TEXT NOT NULL DEFAULT '[]',
    skill_reflection      TEXT NOT NULL DEFAULT '',
    growth_reflection     TEXT NOT NULL DEFAULT '',
    support_selections    TEXT NOT NULL DEFAULT '[]',
    next_step_selections  TEXT NOT NULL DEFAULT '[]',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at            TIMESTAMPTZ,
    create_user_id        INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    update_user_id        INTEGER REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_learning_record_entries_user_id
    ON public.learning_record_entries(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_learning_record_entries_client_id
    ON public.learning_record_entries(user_id, client_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_learning_record_entries_deleted_at
    ON public.learning_record_entries(deleted_at);

CREATE INDEX IF NOT EXISTS idx_learning_record_entries_create_user_id
    ON public.learning_record_entries(create_user_id);

CREATE INDEX IF NOT EXISTS idx_learning_record_entries_update_user_id
    ON public.learning_record_entries(update_user_id);

ALTER TYPE feature ADD VALUE IF NOT EXISTS 'learning_record';

INSERT INTO public.feature_flags (name, enabled)
VALUES ('learning_record', FALSE)
ON CONFLICT (name) DO NOTHING;

-- +goose Down
DELETE FROM public.feature_flags WHERE name = 'learning_record';
DROP TABLE IF EXISTS public.learning_record_entries;
