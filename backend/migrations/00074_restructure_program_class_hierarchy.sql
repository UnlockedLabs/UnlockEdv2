-- Ticket id751 -- restructure Program -> Class -> Cohort.
--
-- ONE migration, four parts, one transaction. Read this header before running it.
--
--   Part 1  rename today's program_classes to program_class_cohorts, because those rows
--           always were cohorts. Pure rename: no new objects, zero rows moved.
--   Part 2  create the certificate-bearing Class tier above them, plus the merge key.
--   Part 3  backfill -- group cohorts into classes, then constrain. THIS is the part
--           that makes judgement calls about real data.
--   Part 4  audit the new tier.
--
-- ============================================================================
-- ⚠️  RUN THE DRY-RUN REPORT BEFORE APPLYING THIS TO ANY SHARED ENVIRONMENT.
--
--     docs/id751/dry_run_report.sql   (read-only, safe to run anywhere)
--
--     Part 3 decides which cohorts collapse into one class using class_group_key(),
--     which is deliberately aggressive -- it has to be, or "Anger Management (9am-10am)"
--     and "(11am-12pm)" stay two classes and the whole tier is 1:1 overhead. Aggressive
--     also means it can be WRONG on names nobody has looked at yet. The report shows you
--     exactly what would merge, and sizes the two data changes in Part 3 (§3j, §3l)
--     before they happen. R3a must come back empty; R3b/R3c want human eyes.
--
--     Dev's seeded names contain no true duplicates, so this migration merges NOTHING
--     in dev. Passing in dev tells you the SQL is correct; it tells you nothing about
--     whether the merge is right. That is what the report is for.
-- ============================================================================
--
-- Identifier names in Part 1 were discovered against a live database, not guessed. The
-- 00043 sections->classes rename renamed tables but left constraints, indexes and
-- sequences on their program_section* names; this migration fixes those too, so we don't
-- end up with program_sections_pkey on a table called program_class_cohorts.
--
-- Part 3 writes a durable record of everything it decided to
-- public.id751_restructure_log -- the merge tool's backlog, and what the down path uses
-- to reverse its two data changes exactly.

-- +goose Up
-- +goose StatementBegin

-- ALTER TABLE ... RENAME CONSTRAINT has no IF EXISTS, so gate it.
CREATE OR REPLACE FUNCTION _id751_ren_con(tbl regclass, old_name text, new_name text)
RETURNS void AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = tbl AND conname = old_name) THEN
        EXECUTE format('ALTER TABLE %s RENAME CONSTRAINT %I TO %I', tbl::text, old_name, new_name);
    END IF;
END;
$$ LANGUAGE plpgsql;


-- ##################################################################################
-- ## PART 1 -- the rename. Today's classes are cohorts.
-- ##################################################################################

----------------------------------------------------------------------------------
-- 1.1 the rename that gives this migration its name
----------------------------------------------------------------------------------
ALTER TABLE public.program_classes RENAME TO program_class_cohorts;

----------------------------------------------------------------------------------
-- 1.2 columns that always held a cohort id and were merely misnamed. Zero rows move.
--     NOT program_class_event_overrides: its Go ClassID is a query-time alias
--     (gorm:"->" in class_event.go), not a column.
----------------------------------------------------------------------------------
ALTER TABLE public.program_class_enrollments RENAME COLUMN class_id TO cohort_id;
ALTER TABLE public.program_class_events      RENAME COLUMN class_id TO cohort_id;

----------------------------------------------------------------------------------
-- 1.3 program_completions is, and always has been, a CLASS completion record: it is
--     keyed by a single program_class_id. Renaming it now frees the name
--     "program_completions" for the Scenario 2 program-level grant, so no name ever
--     means two things across the migration boundary.
----------------------------------------------------------------------------------
ALTER TABLE public.program_completions RENAME TO class_completions;
ALTER TABLE public.class_completions RENAME COLUMN program_class_id       TO cohort_id;
-- Renamed straight to class_name: the certificate names the CLASS. §5.2 repopulates the
-- values, which until then still hold the cohort's name.
ALTER TABLE public.class_completions RENAME COLUMN program_class_name     TO class_name;
ALTER TABLE public.class_completions RENAME COLUMN program_class_start_dt TO cohort_start_dt;

-- Flag determines whether the program is completable or if it is just a category of classes
ALTER TABLE public.programs
    ADD COLUMN IF NOT EXISTS has_program_completion BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN public.programs.has_program_completion IS
    'true when the program is completable in its own right, separately from '
    'its classes. false (default) is the class tier carries the '
    'certificate and the program is only a grouping. Per program, global across '
    'facilities. As of this migration nothing reads it: the rule that satisfies a '
    'program completion (all enrolled classes vs at least one) is still an open '
    'product decision.';

----------------------------------------------------------------------------------
-- 1.4 constraints -- drop the program_section* legacy naming
----------------------------------------------------------------------------------
SELECT _id751_ren_con('public.program_class_cohorts', 'program_sections_pkey',              'program_class_cohorts_pkey');
SELECT _id751_ren_con('public.program_class_cohorts', 'program_sections_program_id_fkey',   'program_class_cohorts_program_id_fkey');
SELECT _id751_ren_con('public.program_class_cohorts', 'program_sections_facility_id_fkey',  'program_class_cohorts_facility_id_fkey');

SELECT _id751_ren_con('public.program_class_enrollments', 'program_section_enrollments_pkey',            'program_class_enrollments_pkey');
SELECT _id751_ren_con('public.program_class_enrollments', 'program_section_enrollments_section_id_fkey', 'program_class_enrollments_cohort_id_fkey');
SELECT _id751_ren_con('public.program_class_enrollments', 'program_section_enrollments_user_id_fkey',    'program_class_enrollments_user_id_fkey');

SELECT _id751_ren_con('public.program_class_events', 'program_section_events_pkey',            'program_class_events_pkey');
SELECT _id751_ren_con('public.program_class_events', 'program_section_events_section_id_fkey', 'program_class_events_cohort_id_fkey');

SELECT _id751_ren_con('public.program_class_event_attendance', 'program_section_event_attendance_pkey',          'program_class_event_attendance_pkey');
SELECT _id751_ren_con('public.program_class_event_attendance', 'program_section_event_attendance_event_id_fkey', 'program_class_event_attendance_event_id_fkey');
SELECT _id751_ren_con('public.program_class_event_attendance', 'program_section_event_attendance_user_id_fkey',  'program_class_event_attendance_user_id_fkey');

SELECT _id751_ren_con('public.program_class_event_overrides', 'program_section_event_overrides_pkey',          'program_class_event_overrides_pkey');
SELECT _id751_ren_con('public.program_class_event_overrides', 'program_section_event_overrides_event_id_fkey', 'program_class_event_overrides_event_id_fkey');

SELECT _id751_ren_con('public.program_classes_history', 'programs_sections_history_pkey', 'program_classes_history_pkey');

SELECT _id751_ren_con('public.class_completions', 'program_completions_pkey',                    'class_completions_pkey');
SELECT _id751_ren_con('public.class_completions', 'program_completions_program_section_id_fkey', 'class_completions_cohort_id_fkey');
SELECT _id751_ren_con('public.class_completions', 'program_completions_program_id_fkey',         'class_completions_program_id_fkey');
SELECT _id751_ren_con('public.class_completions', 'program_completions_user_id_fkey',            'class_completions_user_id_fkey');
SELECT _id751_ren_con('public.class_completions', 'fk_program_completions_create_user_id',       'fk_class_completions_create_user_id');
SELECT _id751_ren_con('public.class_completions', 'fk_program_completions_update_user_id',       'fk_class_completions_update_user_id');

----------------------------------------------------------------------------------
-- 1.5 sequences
----------------------------------------------------------------------------------
ALTER SEQUENCE IF EXISTS public.program_sections_id_seq                   RENAME TO program_class_cohorts_id_seq;
ALTER SEQUENCE IF EXISTS public.program_section_enrollments_id_seq        RENAME TO program_class_enrollments_id_seq;
ALTER SEQUENCE IF EXISTS public.program_section_events_id_seq             RENAME TO program_class_events_id_seq;
ALTER SEQUENCE IF EXISTS public.program_section_event_attendance_id_seq   RENAME TO program_class_event_attendance_id_seq;
ALTER SEQUENCE IF EXISTS public.program_section_event_overrides_id_seq    RENAME TO program_class_event_overrides_id_seq;
ALTER SEQUENCE IF EXISTS public.programs_sections_history_id_seq          RENAME TO program_classes_history_id_seq;
ALTER SEQUENCE IF EXISTS public.program_completions_id_seq                RENAME TO class_completions_id_seq;

----------------------------------------------------------------------------------
-- 1.6 indexes
----------------------------------------------------------------------------------
ALTER INDEX IF EXISTS public.idx_program_sections_deleted_at   RENAME TO idx_program_class_cohorts_deleted_at;
ALTER INDEX IF EXISTS public.idx_program_sections_end_dt       RENAME TO idx_program_class_cohorts_end_dt;
ALTER INDEX IF EXISTS public.idx_program_sections_facility_id  RENAME TO idx_program_class_cohorts_facility_id;
ALTER INDEX IF EXISTS public.idx_program_sections_program_id   RENAME TO idx_program_class_cohorts_program_id;

ALTER INDEX IF EXISTS public.idx_program_section_enrollments_deleted_at  RENAME TO idx_program_class_enrollments_deleted_at;
ALTER INDEX IF EXISTS public.idx_program_section_enrollments_section_id  RENAME TO idx_program_class_enrollments_cohort_id;
ALTER INDEX IF EXISTS public.idx_program_section_enrollments_user_id     RENAME TO idx_program_class_enrollments_user_id;

ALTER INDEX IF EXISTS public.idx_section_events_deleted_at  RENAME TO idx_program_class_events_deleted_at;
ALTER INDEX IF EXISTS public.idx_section_events_duration    RENAME TO idx_program_class_events_duration;
ALTER INDEX IF EXISTS public.idx_section_events_section_id  RENAME TO idx_program_class_events_cohort_id;

ALTER INDEX IF EXISTS public.idx_program_section_event_overrides_deleted_at   RENAME TO idx_program_class_event_overrides_deleted_at;
ALTER INDEX IF EXISTS public.idx_program_section_event_overrides_duration     RENAME TO idx_program_class_event_overrides_duration;
ALTER INDEX IF EXISTS public.idx_program_section_event_overrides_event_id     RENAME TO idx_program_class_event_overrides_event_id;
ALTER INDEX IF EXISTS public.idx_program_section_event_overrides_is_cancelled RENAME TO idx_program_class_event_overrides_is_cancelled;

ALTER INDEX IF EXISTS public.idx_program_completions_program_class_id RENAME TO idx_class_completions_cohort_id;
ALTER INDEX IF EXISTS public.idx_program_completions_create_user_id   RENAME TO idx_class_completions_create_user_id;
ALTER INDEX IF EXISTS public.idx_program_completions_update_user_id   RENAME TO idx_class_completions_update_user_id;

----------------------------------------------------------------------------------
-- 1.7 trigger. The function needs no change: log_program_classes_updates() (00045)
--     uses TG_TABLE_NAME, so from here it writes 'program_class_cohorts' by itself.
--     That is exactly why 1.8 is mandatory.
----------------------------------------------------------------------------------
ALTER TRIGGER sql_trigger_program_classes_update ON public.program_class_cohorts
    RENAME TO sql_trigger_program_class_cohorts_update;

----------------------------------------------------------------------------------
-- 1.8 MANDATORY audit-discriminator rewrite.
--
--     program_classes_history and change_log_entries key on (table_name, parent_ref_id)
--     with no foreign key. Every existing row labelled 'program_classes' describes what
--     we now call a cohort, so relabelling makes the audit trail MORE accurate.
--
--     Skip this and the new program_classes table in Part 2 inherits cohort #12's
--     history as Class #12's.
--
--     ⚠️  UNTESTED AGAINST REAL DATA -- both audit tables are empty in dev, so this
--         runs as a no-op there. Verify against a staging dump before shipping.
----------------------------------------------------------------------------------
UPDATE public.program_classes_history SET table_name = 'program_class_cohorts'
 WHERE table_name = 'program_classes';
UPDATE public.change_log_entries      SET table_name = 'program_class_cohorts'
 WHERE table_name = 'program_classes';

----------------------------------------------------------------------------------
-- 1.9 cleanup. All three verified against a live database before being written.
----------------------------------------------------------------------------------

-- Duplicate uniqueness guarantee: unique_program_section_event_attendance is
-- UNIQUE (user_id, event_id, date) and idx_event_user_date is UNIQUE (event_id,
-- user_id, date) -- same column set, so dropping one loses no constraint.
ALTER TABLE public.program_class_event_attendance
    DROP CONSTRAINT IF EXISTS unique_program_section_event_attendance;

-- Byte-identical duplicate of idx_program_section_event_overrides_event_id
-- (both plain btree on event_id); introduced by adjacent lines in 00003.
DROP INDEX IF EXISTS public.index_program_section_event_overrides_event_id;

-- Orphaned since 00067 moved instructor assignment to program_class_events.instructor_id
-- as the authoritative location. Absent from every Go model.
ALTER TABLE public.program_class_cohorts DROP COLUMN IF EXISTS instructor_name;


-- ##################################################################################
-- ## PART 2 -- the Class tier. Additive; everything created here is empty or NULL.
-- ##################################################################################

----------------------------------------------------------------------------------
-- 2.1 the new Class tier
--
--     Columns are class-level only. capacity / start_dt / end_dt / status stay on the
--     cohort: a class isn't "Scheduled", its cohorts are. name / description /
--     credit_hours exist on BOTH levels -- the class holds the default, the cohort holds
--     an optional override resolved COALESCE(cohort, class). credit_hours is per-cohort
--     editable today, so dropping it from the cohort would silently change existing data.
--
--     create_user_id / update_user_id get real FKs here. The old table carried the
--     columns without constraints, unlike every other table 00062 audited.
----------------------------------------------------------------------------------
CREATE TABLE public.program_classes (
    id             SERIAL PRIMARY KEY,
    program_id     INTEGER NOT NULL,
    facility_id    INTEGER NOT NULL,
    name           VARCHAR(255) NOT NULL,
    description    TEXT,
    credit_hours   INTEGER,
    archived_at    TIMESTAMPTZ,
    created_at     TIMESTAMPTZ,
    updated_at     TIMESTAMPTZ,
    deleted_at     TIMESTAMPTZ,
    create_user_id INTEGER,
    update_user_id INTEGER,

    CONSTRAINT program_classes_program_id_fkey
        FOREIGN KEY (program_id)  REFERENCES public.programs(id)   ON UPDATE CASCADE,
    CONSTRAINT program_classes_facility_id_fkey
        FOREIGN KEY (facility_id) REFERENCES public.facilities(id) ON UPDATE CASCADE,
    CONSTRAINT fk_program_classes_create_user_id
        FOREIGN KEY (create_user_id) REFERENCES public.users(id) ON DELETE SET NULL,
    CONSTRAINT fk_program_classes_update_user_id
        FOREIGN KEY (update_user_id) REFERENCES public.users(id) ON DELETE SET NULL,

    -- FK target for the composite (class_id, program_id, facility_id) constraint that
    -- §3.6 puts on the cohort. That constraint is what makes the cohort's denormalized
    -- program_id/facility_id impossible to drift, rather than merely discouraged from
    -- drifting by a comment. Must be a real UNIQUE constraint, not a partial index --
    -- Postgres won't accept a partial index as an FK target.
    CONSTRAINT program_classes_id_program_id_facility_id_key
        UNIQUE (id, program_id, facility_id)
);

COMMENT ON TABLE public.program_classes IS
    'The certificate-bearing tier: Program -> Class -> Cohort. Created by id751. One row '
    'per (program, facility, normalized name) group of program_class_cohorts.';
COMMENT ON COLUMN public.program_classes.credit_hours IS
    'Default credit value for the certificate. A cohort may override it; resolve as '
    'COALESCE(cohort.credit_hours, class.credit_hours).';

CREATE INDEX idx_program_classes_deleted_at     ON public.program_classes (deleted_at);
CREATE INDEX idx_program_classes_program_id     ON public.program_classes (program_id);
CREATE INDEX idx_program_classes_facility_id    ON public.program_classes (facility_id);
CREATE INDEX idx_program_classes_archived_at    ON public.program_classes (archived_at);
CREATE INDEX idx_program_classes_create_user_id ON public.program_classes (create_user_id);
CREATE INDEX idx_program_classes_update_user_id ON public.program_classes (update_user_id);

----------------------------------------------------------------------------------
-- 2.2 class ID space -- ordinary ids starting at 1 (owner's call, 2026-08-17)
--
--     `id SERIAL` above starts at 1, and that is deliberately left alone. Class ids and
--     cohort ids therefore OVERLAP.
--
--     An earlier revision restarted this sequence at 1_000_000 so that passing a cohort
--     id where a class id belongs would 404 instead of resolving to a plausible-looking
--     row of the wrong tier. That was a tripwire, never a correctness requirement:
--     separate tables have separate id spaces and every FK resolves correctly either way.
--     It was removed because low, readable ids are worth more day to day than the
--     tripwire, and because the specific bug it was covering for is fixed -- all three
--     FacilityAdminResolver registrations now name the correct table
--     (class_enrollments.go, class_events.go -> TableNameCohort;
--     program_class_tier_handler.go -> TableNameClass).
--
--     What to know, since the safety net is gone. Two places still make the mix-up
--     possible to write, and neither is compiler-checked:
--       * /api/program-classes/{cohort_id} vs /api/classes/{id} -- different tiers, and
--         nothing but the param name distinguishes the values
--       * program_class_enrollments carries BOTH cohort_id and class_id; swapping them in
--         a query compiles and runs
--
--     Canvas guards are unaffected: models/program.go CanvasProgramIDOffset /
--     CanvasClassIDOffset are 100_000_000 and test ">= CanvasClassIDOffset", so ids
--     starting at 1 stay far below them.
--
--     This does NOT affect the audit-discriminator rewrite in §1.8, which fixes the
--     history collision and is still required.
----------------------------------------------------------------------------------
-- (no sequence adjustment: SERIAL already starts at 1)

----------------------------------------------------------------------------------
-- 2.3 class-level credit types
--
--     Credit type is program-level today. The certificate is now class-level, so its
--     credit type belongs with it -- and under Scenario 2, two classes under one program
--     can legitimately carry different types.
--
--     Ships EMPTY, and empty means inherit from program_credit_types. That is exactly
--     today's behaviour, so this table carries no migration risk and no backfill: it only
--     becomes load-bearing when someone sets a class-level override.
--
--     Shape mirrors program_credit_types deliberately (composite PK on the pair, no
--     surrogate id, no timestamps) so the query patterns are interchangeable.
----------------------------------------------------------------------------------
CREATE TABLE public.program_class_credit_types (
    class_id    INTEGER     NOT NULL,
    credit_type credit_type NOT NULL,

    CONSTRAINT program_class_credit_types_pkey PRIMARY KEY (class_id, credit_type),
    CONSTRAINT program_class_credit_types_class_id_fkey
        FOREIGN KEY (class_id) REFERENCES public.program_classes(id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

COMMENT ON TABLE public.program_class_credit_types IS
    'Class-level credit type override. An EMPTY set for a class means inherit from '
    'program_credit_types -- that is the default and matches pre-id751 behaviour.';

----------------------------------------------------------------------------------
-- 2.4 the merge key
--
--     normalize_class_name() strips the cohort disambiguators that sites have been
--     packing into the class name -- the "(9am-10am)" in "Anger Management (9am-10am)".
--     class_group_key() lowercases and flattens the result so it can be grouped on.
--     §3.3 groups cohorts by (program_id, facility_id, class_group_key(name)).
--
--     Both are IMMUTABLE so they are indexable and usable in a GROUP BY.
--
--     THREE PROPERTIES THAT MATTER, in descending order of how badly their absence
--     would hurt:
--
--     a) It never returns empty. If the whole name is a disambiguator ("Morning Cohort",
--        "(9am)") stripping would leave nothing, and every such cohort across a facility
--        would group together into one nonsense class. So a strip that empties the string
--        is discarded and the original trimmed name is returned instead. Those cohorts
--        become their own single-cohort classes -- correct, since we genuinely cannot
--        tell what class they belong to. They land in R3c for a human.
--
--     b) It never strips a bare trailing number. "Algebra 1" and "Algebra 2" are two
--        different classes, not two cohorts of one. A trailing number is only stripped
--        when a keyword marks it as an enumerator ("Algebra Section 2", "Algebra #2").
--        This is the deliberate false-negative that keeps the aggressive normalizer safe.
--
--     c) It terminates. The strip loop runs until the string stops changing, capped at 8
--        passes. Iteration is what lets "Anger Management (9am-10am) - Mon/Wed/Fri" peel
--        back to "Anger Management" instead of stopping at the first match.
--
--     ⚠️  STRICT: NULL name in, NULL out. cohort.name is nullable, and SQL groups all
--         NULLs together -- so callers MUST NOT group on a bare class_group_key(name).
--         §3.3 falls back to a row-unique key for unnamed cohorts. There are zero NULL
--         and zero blank cohort names in dev, which is exactly why this would pass review
--         and then bite on a real dump.
----------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_class_name(raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE STRICT
AS $fn$
DECLARE
    cur      text := btrim(raw);
    prev     text;
    stripped text;
    passes   int  := 0;
BEGIN
    IF cur = '' THEN
        RETURN cur;
    END IF;

    LOOP
        passes := passes + 1;
        prev   := cur;

        -- trailing separators and punctuation left behind by an earlier strip
        cur := regexp_replace(cur, '[[:space:]\-–—:;,./|~]+$', '');

        -- a trailing bracketed group: "(9am-10am)", "[Unit B]", "{PM}"
        cur := regexp_replace(cur, '[[:space:]]*[\(\[\{][^\(\)\[\]\{\}]*[\)\]\}][[:space:]]*$', '');

        -- a trailing time range: "9-10am", "9:00-10:00", "9:00 AM - 10:00 AM", "9 to 10"
        cur := regexp_replace(cur,
            '[[:space:]]*\m\d{1,2}(:\d{2})?[[:space:]]*(a\.?m\.?|p\.?m\.?)?[[:space:]]*(-|–|—|to|thru|through)[[:space:]]*\d{1,2}(:\d{2})?[[:space:]]*(a\.?m\.?|p\.?m\.?)?[[:space:]]*$',
            '', 'i');

        -- a trailing single clock time: "9:00", "9:00am", "9am"
        -- (bare "9" is NOT a clock time -- see property (b))
        cur := regexp_replace(cur,
            '[[:space:]]*\m\d{1,2}:\d{2}[[:space:]]*(a\.?m\.?|p\.?m\.?)?[[:space:]]*$', '', 'i');
        cur := regexp_replace(cur,
            '[[:space:]]*\m\d{1,2}[[:space:]]*(a\.?m\.?|p\.?m\.?)[[:space:]]*$', '', 'i');

        -- a trailing day list, written out: "Mon/Wed/Fri", "Tuesday & Thursday"
        cur := regexp_replace(cur,
            '[[:space:]]*\m(mon|tues?|weds?|thur?s?|fri|sat|sun)(day)?([[:space:]/,&\-]+(mon|tues?|weds?|thur?s?|fri|sat|sun)(day)?)*\M[[:space:]]*$',
            '', 'i');

        -- a trailing day list in single-letter codes: "M/W/F", "T-TH".
        -- Requires at least TWO codes joined by a separator, so a name ending in a lone
        -- "F" or "W" ("Track W") is left alone.
        cur := regexp_replace(cur,
            '[[:space:]]*\m(m|t|w|r|f|s|u|th|tu)([[:space:]/,&\-]+(m|t|w|r|f|s|u|th|tu))+\M[[:space:]]*$',
            '', 'i');

        -- a trailing period-of-day word: "Morning", "PM", "Evening"
        cur := regexp_replace(cur,
            '[[:space:]]*\m(morning|afternoon|evening|night|noon|early|late|am|pm)\M[[:space:]]*$',
            '', 'i');

        -- a trailing keyword-marked enumerator: "Cohort 1", "Section B", "Group II",
        -- "Class 2", "Part 1". The keyword is REQUIRED -- that is property (b).
        cur := regexp_replace(cur,
            '[[:space:]]*\m(cohorts?|sections?|sect|groups?|grp|class(es)?|cls|parts?|pt|rounds?|blocks?|terms?|periods?|per|sessions?|batch(es)?|sets?|no|nbr|num|numbers?)\.?[[:space:]]*[#:\-]?[[:space:]]*(\d{1,3}|[ivxlc]{1,5}|[a-z])\M[[:space:]]*$',
            '', 'i');

        -- a trailing bare enumerator: "#3", "2 of 4"
        cur := regexp_replace(cur, '[[:space:]]*#[[:space:]]*\d{1,3}[[:space:]]*$', '');
        cur := regexp_replace(cur,
            '[[:space:]]*\m\d{1,3}[[:space:]]+of[[:space:]]+\d{1,3}[[:space:]]*$', '', 'i');

        stripped := btrim(cur);

        -- property (a): a strip that leaves nothing recognizable is not a strip.
        -- Discard the whole pass and keep what we had.
        IF stripped = '' OR stripped !~ '[[:alnum:]]' THEN
            RETURN btrim(prev);
        END IF;

        cur := stripped;

        EXIT WHEN cur = prev OR passes >= 8;
    END LOOP;

    RETURN cur;
END;
$fn$;

COMMENT ON FUNCTION public.normalize_class_name(text) IS
    'id751: strips trailing cohort disambiguators (parentheticals, time ranges, day '
    'lists, keyword-marked enumerators) from a class name. Never returns empty and never '
    'strips a bare trailing number. Tune these regexes against docs/id751/dry_run_report.sql '
    'output before applying this migration to a shared environment.';

CREATE OR REPLACE FUNCTION public.class_group_key(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE STRICT
AS $fn$
    SELECT btrim(regexp_replace(lower(public.normalize_class_name(raw)), '[^a-z0-9]+', ' ', 'g'))
$fn$;

COMMENT ON FUNCTION public.class_group_key(text) IS
    'id751 merge key: normalize_class_name() lowercased with non-alphanumeric runs '
    'collapsed to single spaces. Cohorts group by (program_id, facility_id, '
    'class_group_key(name)). STRICT -- callers MUST handle a NULL cohort name separately, '
    'or every unnamed cohort groups into one class.';

----------------------------------------------------------------------------------
-- 2.5 the cohort's link to its class. Nullable and unconstrained until §3.6.
----------------------------------------------------------------------------------
ALTER TABLE public.program_class_cohorts ADD COLUMN class_id INTEGER;

CREATE INDEX idx_program_class_cohorts_class_id
    ON public.program_class_cohorts (class_id);

COMMENT ON COLUMN public.program_class_cohorts.class_id IS
    'Parent class. A cohort never changes class.';

-- Say out loud that these are intentional. §3.6 backs the claim with a composite FK,
-- but the comment is what a reader hits first.
COMMENT ON COLUMN public.program_class_cohorts.program_id IS
    'Immutable denormalization of class_id -> program_classes.program_id. Kept on purpose: '
    'it is what lets existing facility/program-scoped queries survive id751 as a table '
    'rename and nothing more. Enforced by program_class_cohorts_class_parent_fkey. '
    'Do not "normalize away".';
COMMENT ON COLUMN public.program_class_cohorts.facility_id IS
    'Immutable denormalization of class_id -> program_classes.facility_id. See the note on '
    'program_id.';

----------------------------------------------------------------------------------
-- 2.6 the restructure log
--
--     Part 3 makes judgement calls about real data. This table records every one of
--     them, and it exists for three reasons:
--
--       1. it is the merge tool's backlog (sub-ticket H) -- which groups collapsed and
--          which near-misses were left alone;
--       2. it is the artifact you show someone who asks what the migration did;
--       3. it is how the down path reverses §3j and §3l EXACTLY, rather than guessing
--          which rows it touched.
--
--     No FK on class_id, deliberately -- the log has to outlive the rows it describes.
--     A follow-up cleanup migration drops this table once the merge tool has consumed it.
----------------------------------------------------------------------------------
CREATE TABLE public.id751_restructure_log (
    id         SERIAL PRIMARY KEY,
    kind       TEXT        NOT NULL,
    class_id   INTEGER,
    detail     JSONB       NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.id751_restructure_log IS
    'What the id751 restructure decided, per row. kind is one of: merge_group, '
    'singleton_group, completion_soft_deleted, enrollment_terminated, summary. '
    'Read by the merge tool (sub-ticket H) and by this migration''s down path. '
    'Safe to drop once sub-ticket H has shipped.';

CREATE INDEX idx_id751_restructure_log_kind ON public.id751_restructure_log (kind);


-- ##################################################################################
-- ## PART 3 -- the backfill. This is the part that touches real data.
-- ##################################################################################

----------------------------------------------------------------------------------
-- 3.1 silence the cohort audit trigger for the duration of the backfill.
--
--     §3.4 updates every cohort row, and the AFTER UPDATE trigger would write two full
--     row_to_json snapshots per row into program_classes_history -- a pile of junk audit
--     rows recording a mechanical migration, plus a large multiplier on write volume.
--
--     Targeted DISABLE TRIGGER rather than session_replication_role = replica, because
--     it cannot accidentally suppress anything else.
----------------------------------------------------------------------------------
ALTER TABLE public.program_class_cohorts
    DISABLE TRIGGER sql_trigger_program_class_cohorts_update;

----------------------------------------------------------------------------------
-- 3.2 a temporary column carries the grouping key from the INSERT to the UPDATE.
--
--     The alternative is INSERT ... RETURNING into a temp mapping table. A temp column
--     is easier to read and easier to review, and it is dropped in §3.5.
----------------------------------------------------------------------------------
ALTER TABLE public.program_classes ADD COLUMN source_group_key TEXT;

----------------------------------------------------------------------------------
-- 3.3 create one class per (program, facility, normalized name) group.
--
--     Field resolution, and why each choice is lossless:
--
--     name          the SHORTEST name in the group, normalized. Shortest because it is
--                   the one with the fewest disambiguators glued on -- "Anger Management"
--                   over "Anger Management (9am-10am)". id breaks ties deterministically.
--     description   earliest non-blank wins. Cosmetic, and every cohort keeps its own.
--     credit_hours  only set when the group agrees on exactly one non-null value.
--                   A group with {10, 20} leaves the class NULL rather than silently
--                   picking one. Cohorts keep their own values either way, and resolution
--                   is COALESCE(cohort, class), so nothing is lost.
--                   ⚠️  One real behaviour change: a cohort with NULL credit_hours in a
--                       group that agrees on 10 now resolves to 10 instead of NULL. That
--                       is the intended semantics of a class-level default -- flagged
--                       because it IS a change. R3e sizes it.
--     archived_at   set only if EVERY cohort in the group is archived. One retired cohort
--                   must not archive its class.
--     deleted_at    same rule -- a class whose cohorts are all soft-deleted is soft-
--                   deleted too. (Task 1.3a: soft-deleted cohorts group like any other
--                   row, since class_id becomes NOT NULL for all of them.)
--     created_at    earliest; updated_at latest.
--
--     The group key falls back to a row-unique value for a NULL or blank name, so unnamed
--     cohorts each become their own class instead of all collapsing into one. See the
--     STRICT warning in §2.4.
----------------------------------------------------------------------------------
WITH keyed AS (
    SELECT c.*,
           coalesce(nullif(public.class_group_key(c.name), ''), 'cohort:' || c.id::text) AS gkey
      FROM public.program_class_cohorts c
),
grouped AS (
    SELECT program_id,
           facility_id,
           gkey,
           (array_agg(name ORDER BY length(coalesce(name, '')), id))[1]            AS rep_name,
           (array_agg(description ORDER BY created_at NULLS LAST, id)
              FILTER (WHERE description IS NOT NULL AND btrim(description) <> ''))[1]
                                                                                   AS rep_description,
           CASE WHEN count(DISTINCT credit_hours) = 1
                THEN max(credit_hours) END                                         AS rep_credit_hours,
           CASE WHEN bool_and(archived_at IS NOT NULL)
                THEN max(archived_at) END                                          AS rep_archived_at,
           CASE WHEN bool_and(deleted_at IS NOT NULL)
                THEN max(deleted_at) END                                           AS rep_deleted_at,
           min(created_at)                                                         AS rep_created_at,
           max(updated_at)                                                         AS rep_updated_at,
           (array_agg(create_user_id ORDER BY created_at NULLS LAST, id)
              FILTER (WHERE create_user_id IS NOT NULL))[1]                        AS rep_create_user_id,
           (array_agg(update_user_id ORDER BY updated_at DESC NULLS LAST, id)
              FILTER (WHERE update_user_id IS NOT NULL))[1]                        AS rep_update_user_id
      FROM keyed
     GROUP BY program_id, facility_id, gkey
)
INSERT INTO public.program_classes
       (program_id, facility_id, name, description, credit_hours,
        archived_at, created_at, updated_at, deleted_at,
        create_user_id, update_user_id, source_group_key)
SELECT program_id,
       facility_id,
       -- NOT NULL on the class, so a group of entirely unnamed cohorts still needs a
       -- label. normalize_class_name is STRICT, hence the outer coalesce.
       coalesce(nullif(btrim(public.normalize_class_name(rep_name)), ''), 'Untitled Class'),
       rep_description,
       rep_credit_hours,
       rep_archived_at,
       rep_created_at,
       rep_updated_at,
       rep_deleted_at,
       rep_create_user_id,
       rep_update_user_id,
       gkey
  FROM grouped;

----------------------------------------------------------------------------------
-- 3.4 point every cohort at its class
----------------------------------------------------------------------------------
UPDATE public.program_class_cohorts c
   SET class_id = pc.id
  FROM public.program_classes pc
 WHERE pc.program_id  = c.program_id
   AND pc.facility_id = c.facility_id
   AND pc.source_group_key = coalesce(nullif(public.class_group_key(c.name), ''),
                                      'cohort:' || c.id::text);

----------------------------------------------------------------------------------
-- 3.5 fail-safe. Assert the backfill was total and 1:many, not 1:1-by-accident or
--     many:1-by-accident, BEFORE any constraint makes the failure look like a
--     constraint problem. Then record what happened, then drop the temp column.
----------------------------------------------------------------------------------
DO $$
DECLARE
    unlinked   bigint;
    n_cohorts  bigint;
    n_classes  bigint;
    n_groups   bigint;
    n_merged   bigint;
BEGIN
    SELECT count(*) INTO unlinked FROM public.program_class_cohorts WHERE class_id IS NULL;
    IF unlinked > 0 THEN
        RAISE EXCEPTION 'id751: % cohort(s) have no class_id after the backfill. The '
                        'grouping key in §3.3 and the join in §3.4 have diverged.', unlinked;
    END IF;

    SELECT count(*) INTO n_cohorts FROM public.program_class_cohorts;
    SELECT count(*) INTO n_classes FROM public.program_classes;
    SELECT count(*) INTO n_groups  FROM (
        SELECT 1 FROM public.program_class_cohorts
         GROUP BY program_id, facility_id,
                  coalesce(nullif(public.class_group_key(name), ''), 'cohort:' || id::text)
    ) g;

    IF n_classes <> n_groups THEN
        RAISE EXCEPTION 'id751: created % classes for % groups. Expected exactly one class '
                        'per group.', n_classes, n_groups;
    END IF;

    SELECT count(*) INTO n_merged FROM (
        SELECT class_id FROM public.program_class_cohorts
         GROUP BY class_id HAVING count(*) > 1
    ) m;

    -- one row per class that actually collapsed something -- the merge tool's backlog
    INSERT INTO public.id751_restructure_log (kind, class_id, detail)
    SELECT 'merge_group', c.class_id,
           jsonb_build_object(
               'class_name',    max(pc.name),
               'program_id',    max(c.program_id),
               'facility_id',   max(c.facility_id),
               'cohort_count',  count(*),
               'cohort_ids',    jsonb_agg(c.id ORDER BY c.id),
               'cohort_names',  jsonb_agg(c.name ORDER BY c.id),
               'credit_hours_differ',
                   count(DISTINCT c.credit_hours) > 1
                   OR (count(c.credit_hours) > 0 AND count(c.credit_hours) < count(*)))
      FROM public.program_class_cohorts c
      JOIN public.program_classes pc ON pc.id = c.class_id
     GROUP BY c.class_id
    HAVING count(*) > 1;

    INSERT INTO public.id751_restructure_log (kind, detail)
    VALUES ('summary', jsonb_build_object(
        'cohorts',                n_cohorts,
        'classes_created',        n_classes,
        'classes_with_1_cohort',  n_classes - n_merged,
        'classes_that_merged',    n_merged));

    RAISE NOTICE 'id751: % cohorts -> % classes (% merged more than one cohort)',
                 n_cohorts, n_classes, n_merged;

    IF n_classes = n_cohorts THEN
        RAISE NOTICE 'id751: NOTHING MERGED -- the class tier is 1:1 with cohorts in this '
                     'environment. Expected in dev (seeded names are all distinct); '
                     'investigate if you see it on staging.';
    END IF;
END $$;

ALTER TABLE public.program_classes DROP COLUMN source_group_key;

----------------------------------------------------------------------------------
-- 3.6 now constrain the cohort. The composite FK is what enforces §2.5's claim that
--     program_id/facility_id cannot drift from the parent class.
----------------------------------------------------------------------------------
ALTER TABLE public.program_class_cohorts
    ALTER COLUMN class_id SET NOT NULL,
    ADD CONSTRAINT program_class_cohorts_class_parent_fkey
        FOREIGN KEY (class_id, program_id, facility_id)
        REFERENCES public.program_classes (id, program_id, facility_id)
        ON UPDATE CASCADE;

----------------------------------------------------------------------------------
-- 3.7 the backfill is done; let the audit trigger fire again.
----------------------------------------------------------------------------------
ALTER TABLE public.program_class_cohorts
    ENABLE TRIGGER sql_trigger_program_class_cohorts_update;

----------------------------------------------------------------------------------
-- 3.8 completions get the class id. This is the column reporting will use.
----------------------------------------------------------------------------------
ALTER TABLE public.class_completions ADD COLUMN class_id INTEGER;

UPDATE public.class_completions cc
   SET class_id = c.class_id
  FROM public.program_class_cohorts c
 WHERE c.id = cc.cohort_id;

CREATE INDEX idx_class_completions_class_id
    ON public.class_completions (class_id) WHERE deleted_at IS NULL;

----------------------------------------------------------------------------------
-- 3.9 stop completion records cascade-deleting. HAZARD FIX.
--
--     Today: deleting a class destroys its completion records -- the residents'
--     certificates. That is already questionable given this table denormalizes
--     program_name / facility_name / credit_type / program_owner SPECIFICALLY so records
--     survive changes upstream. It gets worse after this migration, because the FK now
--     follows to cohort_id: deleting a single retired cohort would erase class completions
--     residents legitimately earned.
--
--     program_id has to lose its NOT NULL for SET NULL to be expressible. That is the
--     point -- the denormalized program_name carries what reporting needs.
----------------------------------------------------------------------------------
ALTER TABLE public.class_completions
    DROP CONSTRAINT IF EXISTS class_completions_cohort_id_fkey,
    DROP CONSTRAINT IF EXISTS class_completions_program_id_fkey;

ALTER TABLE public.class_completions ALTER COLUMN program_id DROP NOT NULL;

ALTER TABLE public.class_completions
    ADD CONSTRAINT class_completions_cohort_id_fkey
        FOREIGN KEY (cohort_id) REFERENCES public.program_class_cohorts(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    ADD CONSTRAINT class_completions_program_id_fkey
        FOREIGN KEY (program_id) REFERENCES public.programs(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    ADD CONSTRAINT class_completions_class_id_fkey
        FOREIGN KEY (class_id) REFERENCES public.program_classes(id)
        ON UPDATE CASCADE ON DELETE SET NULL;

COMMENT ON COLUMN public.class_completions.program_id IS
    'Nullable on purpose (id751): the FK is ON DELETE SET NULL so a deleted program cannot '
    'destroy earned certificates. program_name carries what reporting needs. Do not add '
    'gorm:"not null" to this field.';

----------------------------------------------------------------------------------
-- 3.10 one certificate per class.
--
--      ⚠️  THIS IS THE OPEN PRODUCT QUESTION IN THIS MIGRATION (disagreements #7).
--          Merging "X (9am)" and "X (11am)" means a resident who completed both now holds
--          two completion rows under one class. That was correct when they were two
--          distinct classes. Whether it stays correct is policy, not schema:
--
--            one-per-class  matches "the class is the certificate" and the diagram's star.
--                           Implemented here.
--            per-cohort     no constraint, dedupe with COUNT(DISTINCT user_id) in every
--                           report and in the resident-facing view.
--
--      To reverse this decision without a new migration: drop the unique index below and
--      clear deleted_at on the rows logged as 'completion_soft_deleted'. That is exactly
--      what the down path does.
--
--      Duplicates are SOFT-deleted, earliest kept, so nothing is unrecoverable. The index
--      is partial on deleted_at IS NULL, so a revoked certificate can still be re-earned.
----------------------------------------------------------------------------------
WITH dupes AS (
    SELECT cc.id
      FROM public.class_completions cc
     WHERE cc.deleted_at IS NULL
       AND cc.class_id IS NOT NULL
       AND EXISTS (
           SELECT 1 FROM public.class_completions keep
            WHERE keep.user_id  = cc.user_id
              AND keep.class_id = cc.class_id
              AND keep.deleted_at IS NULL
              -- coalesce, not a bare comparison: created_at is nullable, and a row
              -- comparison involving NULL yields NULL, so NULL-timestamped duplicates
              -- would slip past this and fail the unique index below instead.
              AND (coalesce(keep.created_at, '-infinity'::timestamptz), keep.id)
                < (coalesce(cc.created_at,   '-infinity'::timestamptz), cc.id))
),
marked AS (
    UPDATE public.class_completions cc
       SET deleted_at = now()
      FROM dupes d
     WHERE cc.id = d.id
    RETURNING cc.id, cc.user_id, cc.class_id, cc.cohort_id
)
INSERT INTO public.id751_restructure_log (kind, class_id, detail)
SELECT 'completion_soft_deleted', class_id,
       jsonb_build_object('completion_id', id, 'user_id', user_id, 'cohort_id', cohort_id)
  FROM marked;

CREATE UNIQUE INDEX class_completions_user_class_uniq
    ON public.class_completions (user_id, class_id)
 WHERE deleted_at IS NULL;

----------------------------------------------------------------------------------
-- 3.11 denormalize class_id onto enrollments.
--
--      An enrollment never changes cohort -- a transfer terminates one enrollment and
--      creates another, which is what enrollment_ended_at is for -- so this cannot drift,
--      same reasoning as the cohort's program_id/facility_id.
--
--      It buys two things:
--        1. a DB-level guard against concurrent enrollment in sibling cohorts (§3.12);
--        2. "roll cohort enrollment up to the class level for reporting" -- a literal
--           user story in the ticket -- becomes a single-table group-by.
--
--      NOTE the name. This table's OLD class_id was renamed to cohort_id in §1.2, and
--      this new class_id means the class tier, matching program_class_cohorts.class_id.
--      Consistent across tables, but a genuine trap for anyone holding the old mental
--      model. The offset id space in §2.2 is what turns that mistake into a 404.
----------------------------------------------------------------------------------
ALTER TABLE public.program_class_enrollments ADD COLUMN class_id INTEGER;

UPDATE public.program_class_enrollments e
   SET class_id = c.class_id
  FROM public.program_class_cohorts c
 WHERE c.id = e.cohort_id;

ALTER TABLE public.program_class_enrollments
    ALTER COLUMN class_id SET NOT NULL,
    ADD CONSTRAINT program_class_enrollments_class_id_fkey
        FOREIGN KEY (class_id) REFERENCES public.program_classes(id) ON UPDATE CASCADE;

CREATE INDEX idx_program_class_enrollments_class_id
    ON public.program_class_enrollments (class_id);

COMMENT ON COLUMN public.program_class_enrollments.class_id IS
    'Immutable denormalization of cohort_id -> program_class_cohorts.class_id (id751). An '
    'enrollment never changes cohort. NOT the pre-id751 class_id -- that column is now '
    'cohort_id.';

----------------------------------------------------------------------------------
-- 3.12 no two ACTIVE enrollments in one class.
--
--      Sequentially is fine and essential -- enroll at 9am, transfer or drop out,
--      re-enroll at 11am next term. The terminal statuses enumerate exactly this.
--      Concurrently is meaningless and corrupts attendance, because the resident is
--      expected at two sets of events.
--
--      Non-terminal means enrollment_status = 'Enrolled' (models.IsTerminalEnrollment
--      treats Cancelled, Completed and Incomplete:* as terminal).
--
--      ⚠️  MERGING CAN CREATE VIOLATIONS -- a resident actively enrolled in two cohorts
--          that are now siblings. Those pairs did not violate anything before this
--          migration, so the index cannot simply be created. The later enrollment is
--          terminated as 'Incomplete: Transfered' -- the status the domain already uses
--          for this -- and every row touched is logged so the down path can restore it
--          and so a human can review afterwards. R3h sizes this before you apply.
----------------------------------------------------------------------------------
WITH conflicts AS (
    SELECT e.id
      FROM public.program_class_enrollments e
     WHERE e.deleted_at IS NULL
       AND e.enrollment_status = 'Enrolled'
       AND EXISTS (
           SELECT 1 FROM public.program_class_enrollments keep
            WHERE keep.user_id  = e.user_id
              AND keep.class_id = e.class_id
              AND keep.deleted_at IS NULL
              AND keep.enrollment_status = 'Enrolled'
              -- coalesce for the same reason as §3.10: enrolled_at is nullable.
              AND (coalesce(keep.enrolled_at, '-infinity'::timestamptz), keep.id)
                < (coalesce(e.enrolled_at,    '-infinity'::timestamptz), e.id))
),
terminated AS (
    UPDATE public.program_class_enrollments e
       SET enrollment_status   = 'Incomplete: Transfered',
           change_reason       = 'id751 restructure: sibling cohorts merged into one class',
           enrollment_ended_at = now(),
           updated_at          = now()
      FROM conflicts x
     WHERE e.id = x.id
    RETURNING e.id, e.user_id, e.class_id, e.cohort_id, e.enrolled_at
)
INSERT INTO public.id751_restructure_log (kind, class_id, detail)
SELECT 'enrollment_terminated', class_id,
       jsonb_build_object('enrollment_id', id, 'user_id', user_id,
                          'cohort_id', cohort_id, 'enrolled_at', enrolled_at)
  FROM terminated;

CREATE UNIQUE INDEX program_class_enrollments_active_user_class_uniq
    ON public.program_class_enrollments (user_id, class_id)
 WHERE enrollment_status = 'Enrolled' AND deleted_at IS NULL;


-- ##################################################################################
-- ## PART 4 -- audit the new tier. LAST, deliberately.
-- ##################################################################################

----------------------------------------------------------------------------------
-- 4.1 log_program_classes_updates() is generic over TG_TABLE_NAME (00045), so it serves
--     this table unchanged and writes table_name = 'program_classes'.
--
--     That label is only unambiguous because §1.8 already relabelled every pre-existing
--     'program_classes' row to 'program_class_cohorts'. From here, 'program_classes' in
--     program_classes_history and change_log_entries means the class tier and nothing
--     else.
--
--     Created last so it cannot fire during Part 3 and cannot be caught by §1.8's
--     UPDATE. Ordering, not coincidence.
--
--     The function itself is NOT renamed. It is generic, not wrong, and this migration
--     already renames a great many identifiers.
----------------------------------------------------------------------------------
CREATE TRIGGER sql_trigger_program_classes_update
    AFTER UPDATE ON public.program_classes
    FOR EACH ROW EXECUTE FUNCTION public.log_program_classes_updates();


-- ##################################################################################
-- ## PART 5 -- retire the cohort's name. A cohort is not a thing with a name.
-- ##################################################################################
--
-- A cohort is one RUN of a class. Users only ever saw the class's name; the cohort's own
-- ("GED Testing -- Winter") was a schedule label that read wrong wherever a class name
-- belonged. Every display path now reads program_classes.name, so the column goes.
--
-- Runs LAST, after §3 has given every cohort a parent class -- the repopulation below
-- depends on class_id being NOT NULL and correct.

----------------------------------------------------------------------------------
-- 5.1 log every cohort name before dropping it, so the down path restores EXACTLY
--     rather than guessing. Same contract as §3.10/§3.12.
----------------------------------------------------------------------------------
INSERT INTO public.id751_restructure_log (kind, class_id, detail)
SELECT 'cohort_name_dropped',
       c.class_id,
       jsonb_build_object('cohort_id', c.id, 'name', c.name)
FROM public.program_class_cohorts c
WHERE c.name IS NOT NULL;

----------------------------------------------------------------------------------
-- 5.2 the certificate names the CLASS. §1.3 renamed the column; the values in it are
--     still the cohort's names, so repoint them at the parent class.
--
--     class_id is nullable here (§3.9 made the FK SET NULL so deleting a cohort cannot
--     erase an earned certificate), so a certificate whose class was already deleted
--     keeps whatever name it was issued with. That is correct: the snapshot exists
--     precisely to outlive the row it names.
----------------------------------------------------------------------------------
UPDATE public.class_completions cc
SET    class_name = pc.name
FROM   public.program_classes pc
WHERE  pc.id = cc.class_id;

----------------------------------------------------------------------------------
-- 5.3 attendance audit rows store the class name as a plain string, and
--     GenerateAttendanceReport joins on it to resolve "recorded by". The writer now
--     records the CLASS's name, so historical rows must move too, or every
--     pre-migration attendance row silently loses its recorded_by attribution.
--
--     Matched on the old cohort name. Where one cohort name maps to exactly one class
--     name this is exact; ambiguous names are LEFT ALONE and logged rather than
--     guessed, because a wrong attribution is worse than a missing one.
----------------------------------------------------------------------------------
CREATE TEMP TABLE _id751_uah_map ON COMMIT DROP AS
SELECT   c.name AS old_name, min(pc.name) AS new_name, count(DISTINCT pc.name) AS n
FROM     public.program_class_cohorts c
JOIN     public.program_classes pc ON pc.id = c.class_id
WHERE    c.name IS NOT NULL
GROUP BY c.name;

INSERT INTO public.id751_restructure_log (kind, class_id, detail)
SELECT 'uah_class_name_ambiguous', NULL,
       jsonb_build_object('old_name', old_name, 'distinct_class_names', n)
FROM   _id751_uah_map
WHERE  n > 1;

UPDATE public.user_account_history uah
SET    class_name = m.new_name
FROM   _id751_uah_map m
WHERE  uah.class_name = m.old_name
  AND  m.n = 1
  AND  m.new_name IS DISTINCT FROM m.old_name;

----------------------------------------------------------------------------------
-- 5.4 and drop it.
----------------------------------------------------------------------------------
ALTER TABLE public.program_class_cohorts DROP COLUMN name;

DROP FUNCTION _id751_ren_con(regclass, text, text);

-- +goose StatementEnd


-- +goose Down
-- +goose StatementBegin
--
-- Reverses in the opposite order. Two notes on fidelity:
--
--   * instructor_name values are NOT recoverable (§1.9 dropped the column). It comes back
--     empty.
--   * the §3.10 and §3.12 data changes ARE reversed exactly, from
--     id751_restructure_log. That is what the table is for.
--

CREATE OR REPLACE FUNCTION _id751_ren_con(tbl regclass, old_name text, new_name text)
RETURNS void AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = tbl AND conname = old_name) THEN
        EXECUTE format('ALTER TABLE %s RENAME CONSTRAINT %I TO %I', tbl::text, old_name, new_name);
    END IF;
END;
$$ LANGUAGE plpgsql;

----------------------------------------------------------------------------------
-- 5. the cohort's name, restored EXACTLY from the §5.1 log.
--
--    Restored before anything else in this path, because §1.3's reversal below renames
--    class_completions.class_name back and the cohort table must be whole first.
--
--    The column was nullable varchar(255) with no default, so ADD COLUMN restores it
--    exactly. A cohort created AFTER the up migration ran has no logged name -- nothing
--    to restore -- so it takes the class's name, which is what it was displaying anyway.
----------------------------------------------------------------------------------
-- IF NOT EXISTS so this path also runs against a database that was migrated by an
-- earlier revision of this file, before §5 dropped the column.
ALTER TABLE public.program_class_cohorts ADD COLUMN IF NOT EXISTS name VARCHAR(255);

UPDATE public.program_class_cohorts c
SET    name = (l.detail ->> 'name')
FROM   public.id751_restructure_log l
WHERE  l.kind = 'cohort_name_dropped'
  AND  (l.detail ->> 'cohort_id')::bigint = c.id;

UPDATE public.program_class_cohorts c
SET    name = pc.name
FROM   public.program_classes pc
WHERE  pc.id = c.class_id
  AND  c.name IS NULL;

DELETE FROM public.id751_restructure_log
WHERE kind IN ('cohort_name_dropped', 'uah_class_name_ambiguous');

----------------------------------------------------------------------------------
-- 4. the new tier's trigger, before the history rows it wrote
----------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS sql_trigger_program_classes_update ON public.program_classes;

-- ⚠️  DELETES class-tier audit rows. Required, and safe to identify: after §1.8 every row
--     describing a cohort is labelled 'program_class_cohorts', so any 'program_classes'
--     row present now was written for the class tier -- a tier this path is about to drop.
--     Leaving them is worse, because §1.8's own reversal below relabels cohort history
--     back to 'program_classes' and would silently fold these in with colliding
--     parent_ref_ids.
--
--     user_account_history.program_classes_history_id is ON DELETE CASCADE, so dependent
--     account-history rows go too. Correct -- they annotate class mutations that no
--     longer exist.
DELETE FROM public.program_classes_history WHERE table_name = 'program_classes';
DELETE FROM public.change_log_entries      WHERE table_name = 'program_classes';

----------------------------------------------------------------------------------
-- 3.12 / 3.11 enrollments
----------------------------------------------------------------------------------
DROP INDEX IF EXISTS public.program_class_enrollments_active_user_class_uniq;

-- restore the enrollments terminated by the merge, exactly
UPDATE public.program_class_enrollments e
   SET enrollment_status   = 'Enrolled',
       change_reason       = NULL,
       enrollment_ended_at = NULL
  FROM public.id751_restructure_log l
 WHERE l.kind = 'enrollment_terminated'
   AND e.id = (l.detail->>'enrollment_id')::int;

DROP INDEX IF EXISTS public.idx_program_class_enrollments_class_id;
ALTER TABLE public.program_class_enrollments
    DROP CONSTRAINT IF EXISTS program_class_enrollments_class_id_fkey;
ALTER TABLE public.program_class_enrollments DROP COLUMN IF EXISTS class_id;

----------------------------------------------------------------------------------
-- 3.10 / 3.9 / 3.8 completions
----------------------------------------------------------------------------------
DROP INDEX IF EXISTS public.class_completions_user_class_uniq;

-- un-soft-delete the duplicates this migration hid, exactly
UPDATE public.class_completions cc
   SET deleted_at = NULL
  FROM public.id751_restructure_log l
 WHERE l.kind = 'completion_soft_deleted'
   AND cc.id = (l.detail->>'completion_id')::int;

COMMENT ON COLUMN public.class_completions.program_id IS NULL;

ALTER TABLE public.class_completions
    DROP CONSTRAINT IF EXISTS class_completions_class_id_fkey,
    DROP CONSTRAINT IF EXISTS class_completions_cohort_id_fkey,
    DROP CONSTRAINT IF EXISTS class_completions_program_id_fkey;

-- restoring NOT NULL requires a value; a program deleted while migrated up would have
-- left NULLs behind, and there is nothing to restore them from.
DO $$
DECLARE orphaned bigint;
BEGIN
    SELECT count(*) INTO orphaned FROM public.class_completions WHERE program_id IS NULL;
    IF orphaned > 0 THEN
        RAISE EXCEPTION 'id751 down: % completion row(s) have a NULL program_id, set by the '
                        'ON DELETE SET NULL this migration installed. Pre-id751 the column '
                        'was NOT NULL and those rows would have been cascade-deleted. '
                        'Decide explicitly -- delete them or reassign program_id -- then '
                        'rerun this down migration.', orphaned;
    END IF;
END $$;

ALTER TABLE public.class_completions ALTER COLUMN program_id SET NOT NULL;

ALTER TABLE public.class_completions
    ADD CONSTRAINT class_completions_cohort_id_fkey
        FOREIGN KEY (cohort_id) REFERENCES public.program_class_cohorts(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    ADD CONSTRAINT class_completions_program_id_fkey
        FOREIGN KEY (program_id) REFERENCES public.programs(id)
        ON UPDATE CASCADE ON DELETE CASCADE;

DROP INDEX IF EXISTS public.idx_class_completions_class_id;
ALTER TABLE public.class_completions DROP COLUMN IF EXISTS class_id;

----------------------------------------------------------------------------------
-- 3.6 / 2.5 the cohort's class link
----------------------------------------------------------------------------------
ALTER TABLE public.program_class_cohorts
    DROP CONSTRAINT IF EXISTS program_class_cohorts_class_parent_fkey;

COMMENT ON COLUMN public.program_class_cohorts.program_id  IS NULL;
COMMENT ON COLUMN public.program_class_cohorts.facility_id IS NULL;

DROP INDEX IF EXISTS public.idx_program_class_cohorts_class_id;
ALTER TABLE public.program_class_cohorts DROP COLUMN IF EXISTS class_id;

----------------------------------------------------------------------------------
-- 2.6 / 2.4 / 2.3 / 2.1 the rest of the new tier
----------------------------------------------------------------------------------
DROP TABLE IF EXISTS public.id751_restructure_log;

DROP FUNCTION IF EXISTS public.class_group_key(text);
DROP FUNCTION IF EXISTS public.normalize_class_name(text);

DROP TABLE IF EXISTS public.program_class_credit_types;
DROP TABLE IF EXISTS public.program_classes;

----------------------------------------------------------------------------------
-- 1.9 reverse cleanup
----------------------------------------------------------------------------------
ALTER TABLE public.program_class_cohorts ADD COLUMN IF NOT EXISTS instructor_name VARCHAR(255);

CREATE INDEX IF NOT EXISTS index_program_section_event_overrides_event_id
    ON public.program_class_event_overrides USING btree (event_id);

ALTER TABLE public.program_class_event_attendance
    ADD CONSTRAINT unique_program_section_event_attendance UNIQUE (user_id, event_id, date);

----------------------------------------------------------------------------------
-- 1.8 reverse the discriminator rewrite
----------------------------------------------------------------------------------
UPDATE public.program_classes_history SET table_name = 'program_classes'
 WHERE table_name = 'program_class_cohorts';
UPDATE public.change_log_entries      SET table_name = 'program_classes'
 WHERE table_name = 'program_class_cohorts';

----------------------------------------------------------------------------------
-- 1.7 trigger
----------------------------------------------------------------------------------
ALTER TRIGGER sql_trigger_program_class_cohorts_update ON public.program_class_cohorts
    RENAME TO sql_trigger_program_classes_update;

----------------------------------------------------------------------------------
-- 1.6 indexes
----------------------------------------------------------------------------------
ALTER INDEX IF EXISTS public.idx_program_class_cohorts_deleted_at   RENAME TO idx_program_sections_deleted_at;
ALTER INDEX IF EXISTS public.idx_program_class_cohorts_end_dt       RENAME TO idx_program_sections_end_dt;
ALTER INDEX IF EXISTS public.idx_program_class_cohorts_facility_id  RENAME TO idx_program_sections_facility_id;
ALTER INDEX IF EXISTS public.idx_program_class_cohorts_program_id   RENAME TO idx_program_sections_program_id;

ALTER INDEX IF EXISTS public.idx_program_class_enrollments_deleted_at  RENAME TO idx_program_section_enrollments_deleted_at;
ALTER INDEX IF EXISTS public.idx_program_class_enrollments_cohort_id   RENAME TO idx_program_section_enrollments_section_id;
ALTER INDEX IF EXISTS public.idx_program_class_enrollments_user_id     RENAME TO idx_program_section_enrollments_user_id;

ALTER INDEX IF EXISTS public.idx_program_class_events_deleted_at  RENAME TO idx_section_events_deleted_at;
ALTER INDEX IF EXISTS public.idx_program_class_events_duration    RENAME TO idx_section_events_duration;
ALTER INDEX IF EXISTS public.idx_program_class_events_cohort_id   RENAME TO idx_section_events_section_id;

ALTER INDEX IF EXISTS public.idx_program_class_event_overrides_deleted_at   RENAME TO idx_program_section_event_overrides_deleted_at;
ALTER INDEX IF EXISTS public.idx_program_class_event_overrides_duration     RENAME TO idx_program_section_event_overrides_duration;
ALTER INDEX IF EXISTS public.idx_program_class_event_overrides_event_id     RENAME TO idx_program_section_event_overrides_event_id;
ALTER INDEX IF EXISTS public.idx_program_class_event_overrides_is_cancelled RENAME TO idx_program_section_event_overrides_is_cancelled;

ALTER INDEX IF EXISTS public.idx_class_completions_cohort_id      RENAME TO idx_program_completions_program_class_id;
ALTER INDEX IF EXISTS public.idx_class_completions_create_user_id RENAME TO idx_program_completions_create_user_id;
ALTER INDEX IF EXISTS public.idx_class_completions_update_user_id RENAME TO idx_program_completions_update_user_id;

----------------------------------------------------------------------------------
-- 1.5 sequences
----------------------------------------------------------------------------------
ALTER SEQUENCE IF EXISTS public.program_class_cohorts_id_seq            RENAME TO program_sections_id_seq;
ALTER SEQUENCE IF EXISTS public.program_class_enrollments_id_seq        RENAME TO program_section_enrollments_id_seq;
ALTER SEQUENCE IF EXISTS public.program_class_events_id_seq             RENAME TO program_section_events_id_seq;
ALTER SEQUENCE IF EXISTS public.program_class_event_attendance_id_seq   RENAME TO program_section_event_attendance_id_seq;
ALTER SEQUENCE IF EXISTS public.program_class_event_overrides_id_seq    RENAME TO program_section_event_overrides_id_seq;
ALTER SEQUENCE IF EXISTS public.program_classes_history_id_seq          RENAME TO programs_sections_history_id_seq;
ALTER SEQUENCE IF EXISTS public.class_completions_id_seq                RENAME TO program_completions_id_seq;

----------------------------------------------------------------------------------
-- 1.4 constraints
----------------------------------------------------------------------------------
SELECT _id751_ren_con('public.class_completions', 'fk_class_completions_update_user_id',   'fk_program_completions_update_user_id');
SELECT _id751_ren_con('public.class_completions', 'fk_class_completions_create_user_id',   'fk_program_completions_create_user_id');
SELECT _id751_ren_con('public.class_completions', 'class_completions_user_id_fkey',        'program_completions_user_id_fkey');
SELECT _id751_ren_con('public.class_completions', 'class_completions_program_id_fkey',     'program_completions_program_id_fkey');
SELECT _id751_ren_con('public.class_completions', 'class_completions_cohort_id_fkey',      'program_completions_program_section_id_fkey');
SELECT _id751_ren_con('public.class_completions', 'class_completions_pkey',                'program_completions_pkey');

SELECT _id751_ren_con('public.program_classes_history', 'program_classes_history_pkey', 'programs_sections_history_pkey');

SELECT _id751_ren_con('public.program_class_event_overrides', 'program_class_event_overrides_event_id_fkey', 'program_section_event_overrides_event_id_fkey');
SELECT _id751_ren_con('public.program_class_event_overrides', 'program_class_event_overrides_pkey',          'program_section_event_overrides_pkey');

SELECT _id751_ren_con('public.program_class_event_attendance', 'program_class_event_attendance_user_id_fkey',  'program_section_event_attendance_user_id_fkey');
SELECT _id751_ren_con('public.program_class_event_attendance', 'program_class_event_attendance_event_id_fkey', 'program_section_event_attendance_event_id_fkey');
SELECT _id751_ren_con('public.program_class_event_attendance', 'program_class_event_attendance_pkey',          'program_section_event_attendance_pkey');

SELECT _id751_ren_con('public.program_class_events', 'program_class_events_cohort_id_fkey', 'program_section_events_section_id_fkey');
SELECT _id751_ren_con('public.program_class_events', 'program_class_events_pkey',           'program_section_events_pkey');

SELECT _id751_ren_con('public.program_class_enrollments', 'program_class_enrollments_user_id_fkey',   'program_section_enrollments_user_id_fkey');
SELECT _id751_ren_con('public.program_class_enrollments', 'program_class_enrollments_cohort_id_fkey', 'program_section_enrollments_section_id_fkey');
SELECT _id751_ren_con('public.program_class_enrollments', 'program_class_enrollments_pkey',           'program_section_enrollments_pkey');

SELECT _id751_ren_con('public.program_class_cohorts', 'program_class_cohorts_facility_id_fkey', 'program_sections_facility_id_fkey');
SELECT _id751_ren_con('public.program_class_cohorts', 'program_class_cohorts_program_id_fkey',  'program_sections_program_id_fkey');
SELECT _id751_ren_con('public.program_class_cohorts', 'program_class_cohorts_pkey',             'program_sections_pkey');

----------------------------------------------------------------------------------
-- 1.3 / 1.2 / 1.1 the renames
----------------------------------------------------------------------------------
ALTER TABLE public.class_completions RENAME COLUMN cohort_start_dt TO program_class_start_dt;
ALTER TABLE public.class_completions RENAME COLUMN class_name     TO program_class_name;
ALTER TABLE public.class_completions RENAME COLUMN cohort_id       TO program_class_id;
ALTER TABLE public.class_completions RENAME TO program_completions;

ALTER TABLE public.program_class_events      RENAME COLUMN cohort_id TO class_id;
ALTER TABLE public.program_class_enrollments RENAME COLUMN cohort_id TO class_id;

ALTER TABLE public.program_class_cohorts RENAME TO program_classes;
ALTER TABLE public.programs
    DROP COLUMN IF EXISTS has_program_completion;

DROP FUNCTION _id751_ren_con(regclass, text, text);

-- +goose StatementEnd