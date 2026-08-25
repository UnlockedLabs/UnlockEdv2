-- ============================================================================
-- seed_alaska_demo.sql
--
-- Alaska statewide demo seed (Program Tracking). Modeled on seed_pcc_demo.sql.
--
-- id751: Program -> Class -> Cohort. What this script used to call a "class" is a
-- COHORT (one run: a schedule, a roster, a room). The CLASS above it is the
-- certificate. So each seed row names both, and several classes deliberately carry
-- more than one cohort -- otherwise the tier is 1:1 and no rollup on the Classes tab
-- ever shows a number different from the cohort beneath it.
--
-- ⚠️  A resident cannot hold two ACTIVE enrollments in one class -- enforced by
--     program_class_enrollments_active_user_class_uniq. Residents 1-2 are enrolled in
--     EVERY active cohort here, so two Active sibling cohorts under one class would
--     violate that index and abort the seed. Every multi-cohort class below therefore
--     pairs an Active cohort with a Completed or Scheduled one. Keep that invariant
--     when adding cohorts.
--
-- RE-RUNNABLE: each run first WIPES its own demo data (programs/classes/
-- schedule, rooms, and every non-system_admin user) and rebuilds from scratch,
-- so all relative dates are always "current". The two system_admin accounts
-- (e.g. SuperAdmin, system_batch) are preserved; SuperAdmin is re-homed to PCC.
--
-- Builds 13 Alaska facilities (all America/Anchorage). PCC (Palmer Correctional
-- Center) is the primary facility with full class/event/enrollment/attendance
-- data; the other 12 get skeleton data for cross-facility dashboards.
--
-- Dates are relative to CURRENT_DATE (stable within this transaction):
--   "mo(N)" ~ N*30 days, "wk(N)" = N*7 days.
--
-- USERS get an empty kratos_id and cannot log in until activated. After running:
--   1. Log in as a system_admin (e.g. SuperAdmin).
--   2. Reset Password (single or bulk POST /api/users/bulk/reset-password) for
--      the accounts that need logins (see list at bottom). The backend sees the
--      empty kratos_id and creates the Kratos identity. A system_admin is
--      required to reset the department_admins (carolina.alisio, rich.salas).
--   3. Re-home of SuperAdmin updates the DB only; if its Kratos identity needs
--      the new facility_id, update it via the app or reset.
--
-- DEVIATION FROM SPEC: "NCCER Construction Trades — Spring" is seeded with
-- RELATIVE active dates (-2mo -> +4mo) rather than fixed Apr–Sep 2025, so it is
-- currently Active with past occurrences (required by the demo checklist:
-- 12 enrolled, attendance flags, 2 cancelled past sessions).
--
-- RUN (you execute this yourself):
--   docker exec -i unlockedv2-postgres-1 \
--     psql -U unlocked -d unlocked < scripts/seed_alaska_demo.sql
-- ============================================================================

\set ON_ERROR_STOP on

BEGIN;

-- ===========================================================================
-- PHASE 0. WIPE prior demo data (idempotent rebuild)
-- ===========================================================================
-- Programs domain (children first; see wipe_programs_classes_schedule.sql).
DELETE FROM program_class_event_attendance;
DELETE FROM program_class_event_overrides;
DELETE FROM program_class_events;
DELETE FROM program_class_enrollments;
DELETE FROM class_completions;
DELETE FROM program_class_cohorts;
DELETE FROM program_class_credit_types;
DELETE FROM program_classes;
DELETE FROM facilities_programs;
DELETE FROM program_credit_types;
DELETE FROM program_types;
DELETE FROM programs;
-- 'program_class_cohorts' is where id751 relabelled every pre-existing cohort row;
-- 'program_classes' now means the class tier. Both must go.
DELETE FROM program_classes_history WHERE table_name IN ('programs','program_classes','program_class_cohorts');
DELETE FROM change_log_entries     WHERE table_name IN ('programs','program_classes','program_class_cohorts');

-- Remove every non-system_admin user. Clear the user-FK tables that have no
-- ON DELETE CASCADE first, otherwise the delete is blocked.
DELETE FROM open_content_favorites      WHERE user_id IN (SELECT id FROM users WHERE role <> 'system_admin');
DELETE FROM user_course_activity_totals WHERE user_id IN (SELECT id FROM users WHERE role <> 'system_admin');
DELETE FROM user_enrollments            WHERE user_id IN (SELECT id FROM users WHERE role <> 'system_admin');
DELETE FROM users WHERE role <> 'system_admin';

-- All rooms (only referenced by events/overrides, now gone).
DELETE FROM rooms;

-- Collapse to a single survivor facility, move remaining (system) users onto it,
-- remove all other facilities, then rename/retimezone the survivor to PCC.
UPDATE users SET facility_id = (SELECT min(id) FROM facilities)
 WHERE facility_id <> (SELECT min(id) FROM facilities);
DELETE FROM open_content_favorites WHERE facility_id <> (SELECT min(id) FROM facilities);
DELETE FROM facilities WHERE id <> (SELECT min(id) FROM facilities);
UPDATE facilities
   SET name = 'Palmer Correctional Center', timezone = 'America/Anchorage', updated_at = now()
 WHERE id = (SELECT min(id) FROM facilities);

-- ---------------------------------------------------------------------------
-- Reset the sequences behind every table wiped above.
--
-- DELETE does not rewind a sequence, so without this each re-seed starts where
-- the last one stopped: after three runs classes were at 1000137, cohorts at 148,
-- enrollments at 1010. Ids stay small and comparable between runs instead.
--
-- ⚠️  program_classes restarts at 500 only to keep seeded class ids visually
--     distinct from cohort ids while reading dev data. It is NOT a safety
--     boundary and nothing depends on the ranges staying disjoint: migration
--     00072 §2.2 lets class ids start at 1 in every environment (owner's call,
--     2026-08-17), so the two spaces legitimately overlap. Setting this to 1 is
--     fine if you would rather have 1-69.
--
--     Stays far below CanvasClassIDOffset (100000000), so the ">= offset" Canvas
--     guards are unaffected.
--
-- facilities and users keep survivors (the renamed PCC facility, the
-- system_admins), so those two continue from the highest surviving id rather
-- than restarting -- restarting would collide with the rows still there.
--
-- Note setval() is NOT transactional: if this script later aborts and rolls back,
-- these two calls still stick. Harmless, since the next run sets them again.
-- ---------------------------------------------------------------------------
ALTER SEQUENCE program_class_event_attendance_id_seq RESTART WITH 1;
ALTER SEQUENCE program_class_event_overrides_id_seq  RESTART WITH 1;
ALTER SEQUENCE program_class_events_id_seq           RESTART WITH 1;
ALTER SEQUENCE program_class_enrollments_id_seq      RESTART WITH 1;
ALTER SEQUENCE class_completions_id_seq              RESTART WITH 1;
ALTER SEQUENCE program_class_cohorts_id_seq          RESTART WITH 1;
ALTER SEQUENCE facilities_programs_id_seq            RESTART WITH 1;
ALTER SEQUENCE rooms_id_seq                          RESTART WITH 1;
ALTER SEQUENCE programs_id_seq                       RESTART WITH 1;
ALTER SEQUENCE program_classes_id_seq                RESTART WITH 500;

SELECT setval('facilities_id_seq', COALESCE((SELECT max(id) FROM facilities), 1));
SELECT setval('users_id_seq',      COALESCE((SELECT max(id) FROM users WHERE id < 99999), 1));

-- ===========================================================================
-- PHASE 1. Facilities (13 total, all America/Anchorage)
--   PCC is the survivor above. fac_seed drives the other 12 + skeleton data.
--   idx -> DocID offset (acc=1 -> AK10001..; amcc=2 -> AK20001..; etc.)
-- ===========================================================================
CREATE TEMP TABLE fac_seed (
    key          text,
    name         text,
    idx          int,
    offers_nccer boolean
) ON COMMIT DROP;
INSERT INTO fac_seed VALUES
    ('acc',  'Anchorage Correctional Complex',        1, false),
    ('amcc', 'Anvil Mountain Correctional Center',     2, true),
    ('fcc',  'Fairbanks Correctional Center',          3, false),
    ('gccc', 'Goose Creek Correctional Center',        4, true),
    ('hmcc', 'Hiland Mountain Correctional Center',    5, true),
    ('kcc',  'Ketchikan Correctional Center',          6, false),
    ('lccc', 'Lemon Creek Correctional Center',        7, false),
    ('matsu','Mat-Su Pretrial',                        8, false),
    ('pmcc', 'Point Mackenzie Correctional',           9, false),
    ('sccc', 'Spring Creek Correctional Center',      10, true),
    ('wcc',  'Wildwood Correctional Center',          11, false),
    ('ykcc', 'Yukon-Kuskokwim Correctional Center',   12, false);

INSERT INTO facilities (name, timezone, created_at, updated_at)
SELECT name, 'America/Anchorage', now(), now() FROM fac_seed;

-- ===========================================================================
-- PHASE 2. Rooms  (PCC: 7 specialized; others: 3 standard)
-- ===========================================================================
INSERT INTO rooms (facility_id, name, created_at, updated_at)
SELECT f.id, r.name, now(), now()
FROM (SELECT id FROM facilities WHERE name = 'Palmer Correctional Center') f
CROSS JOIN (VALUES
    ('Vocational Shop'),('Classroom A'),('Computer Lab'),('Small Engine Repair Shop'),
    ('Substance Abuse Treatment Room'),('Chapel / TLC Room'),('Counseling Room')
) AS r(name);

INSERT INTO rooms (facility_id, name, created_at, updated_at)
SELECT fa.id, r.name, now(), now()
FROM fac_seed fs
JOIN facilities fa ON fa.name = fs.name
CROSS JOIN (VALUES ('Classroom A'),('Computer Lab'),('Multipurpose Room')) AS r(name);

-- ===========================================================================
-- PHASE 3. Users (all kratos_id = '')
-- ===========================================================================
-- 3a. Department admins (PCC)
INSERT INTO users (username, name_first, name_last, email, role, kratos_id, facility_id, doc_id, created_at, updated_at)
SELECT u.username, u.first, u.last, u.username || '@alaska.unlocked.v2', 'department_admin', '', f.id, '', now(), now()
FROM (SELECT id FROM facilities WHERE name = 'Palmer Correctional Center') f
CROSS JOIN (VALUES
    ('carolina.alisio', 'Carolina', 'Alisio'),
    ('rich.salas',      'Rich',     'Salas')
) AS u(username, first, last);

-- 3b. PCC title-only staff (facility_admin, DB only)
INSERT INTO users (username, name_first, name_last, email, role, kratos_id, facility_id, doc_id, created_at, updated_at)
SELECT u.username, u.first, u.last, u.username || '@alaska.unlocked.v2', 'facility_admin', '', f.id, '', now(), now()
FROM (SELECT id FROM facilities WHERE name = 'Palmer Correctional Center') f
CROSS JOIN (VALUES
    ('pcc.superintendent',      'PCC',     'Superintendent'),
    ('pcc.asst.superintendent', 'PCC Asst.','Superintendent'),
    ('program.supervisor',      'Program', 'Supervisor IPO III')
) AS u(username, first, last);

-- 3c. PCC instructors (facility_admin)
INSERT INTO users (username, name_first, name_last, email, role, kratos_id, facility_id, doc_id, created_at, updated_at)
SELECT u.username, u.first, u.last, u.username || '@alaska.unlocked.v2', 'facility_admin', '', f.id, '', now(), now()
FROM (SELECT id FROM facilities WHERE name = 'Palmer Correctional Center') f
CROSS JOIN (VALUES
    ('rosa.mayer',                'Rosa',    'Mayer'),
    ('chris.santillan',           'Chris',   'Santillan'),
    ('andria.robers',             'Andria',  'Nelson Robers'),
    ('michael.dintaman',          'Michael', 'Dintaman'),
    ('pcc.education.coordinator',  'PCC',    'Education Coordinator'),
    ('vocational.instructor',      'Vocational','Instructor')
) AS u(username, first, last);

-- 3d. Skeleton education staff (one facility_admin per non-PCC facility)
INSERT INTO users (username, name_first, name_last, email, role, kratos_id, facility_id, doc_id, created_at, updated_at)
SELECT fs.key || '.education.staff', upper(fs.key) || ' Education', 'Staff',
       fs.key || '.education.staff@alaska.unlocked.v2', 'facility_admin', '', fa.id, '', now(), now()
FROM fac_seed fs JOIN facilities fa ON fa.name = fs.name;

-- 3e. PCC residents (30, AK00001..AK00030)
INSERT INTO users (username, name_first, name_last, email, role, kratos_id, facility_id, doc_id, created_at, updated_at)
SELECT
    lower(n.first) || '.' || lower(replace(n.last,' ','')) || '.' || lpad((1000 + n.i)::text, 4, '0'),
    n.first, n.last,
    lower(n.first) || '.' || lower(replace(n.last,' ','')) || '.' || lpad((1000 + n.i)::text, 4, '0') || '@alaska.unlocked.v2',
    'student', '', f.id, 'AK' || lpad(n.i::text, 5, '0'), now(), now()
FROM (SELECT id FROM facilities WHERE name = 'Palmer Correctional Center') f
CROSS JOIN (VALUES
    (1,'James','Naquin'),       (2,'Marcus','Holloway'),   (3,'Kevin','Tran'),
    (4,'Darnell','Bishop'),     (5,'Elijah','Cruz'),       (6,'Antoine','Summers'),
    (7,'Oscar','Reeves'),       (8,'Tyrell','Washington'), (9,'Brandon','Okafor'),
    (10,'Curtis','Pham'),       (11,'Nathan','Yazzie'),    (12,'Dominic','Redcloud'),
    (13,'Isaac','Morales'),     (14,'Leon','Begay'),       (15,'Andre','Thompson'),
    (16,'Raymond','Nakamura'),  (17,'Dwayne','Fitch'),     (18,'Samuel','Ito'),
    (19,'Jerome','Atkins'),     (20,'Calvin','Dupree'),    (21,'Victor','Haines'),
    (22,'Phillip','Reardon'),   (23,'Gregory','Watts'),    (24,'Clarence','Morrow'),
    (25,'Patrick','Solis'),     (26,'Fredrick','Dunbar'),  (27,'Alvin','Castaneda'),
    (28,'Wendell','Price'),     (29,'Herbert','Garza'),    (30,'Mitchell','Ramos')
) AS n(i, first, last);

-- 3f. Skeleton residents (10 per non-PCC facility; DocID = AK<idx*10000 + n>)
INSERT INTO users (username, name_first, name_last, email, role, kratos_id, facility_id, doc_id, created_at, updated_at)
SELECT
    fs.key || '.resident.' || lpad(g::text, 2, '0'),
    'Resident', upper(fs.key) || '-' || lpad(g::text, 2, '0'),
    fs.key || '.resident.' || lpad(g::text, 2, '0') || '@alaska.unlocked.v2',
    'student', '', fa.id,
    'AK' || lpad((fs.idx * 10000 + g)::text, 5, '0'), now(), now()
FROM fac_seed fs
JOIN facilities fa ON fa.name = fs.name
CROSS JOIN generate_series(1, 10) AS g;

-- ===========================================================================
-- PHASE 4. Programs (26) + types + credit types
-- ===========================================================================
INSERT INTO programs (name, description, funding_type, is_active, created_at, updated_at)
SELECT p.name, p.descr, p.funding::funding_type, true, now(), now()
FROM (VALUES
    ('12-Step Recovery Meetings','Peer-led recovery meetings supporting sobriety and accountability.','Inmate_Welfare_Funds'),
    ('Residential Substance Abuse Treatment (RSAT)','Intensive residential treatment for substance use disorders.','Federal_Grants'),
    ('Adult Basic Education (ABE)','Foundational reading, writing, and math instruction.','State_Grants'),
    ('Computer Lab','Digital literacy and computer skills instruction.','Inmate_Welfare_Funds'),
    ('General Education Diploma (GED) Classes and Testing','High school equivalency preparation and testing.','State_Grants'),
    ('Post-Secondary Academic Services','College-level academic coursework and support.','Educational_Grants'),
    ('Alaska Dept. of Environmental Conservation Safe Food Handler Program','Food safety certification training.','State_Grants'),
    ('Alaska Food Worker Card','State food worker card certification.','State_Grants'),
    ('Keytrain / WorkKeys','Career readiness skills assessment and instruction.','State_Grants'),
    ('NCCER Introduction to Construction Trades','Introductory construction trades curriculum (NCCER).','Federal_Grants'),
    ('Small Engine Repair','Hands-on small engine maintenance and repair.','Inmate_Welfare_Funds'),
    ('USDOL Apprenticeship - Electrical','Registered electrical apprenticeship with related technical instruction.','Federal_Grants'),
    ('USDOL Apprenticeship - Building Maintenance','Registered building maintenance apprenticeship.','Federal_Grants'),
    ('USDOL Apprenticeship - Plumbing','Registered plumbing apprenticeship with related technical instruction.','Federal_Grants'),
    ('Welding AWS D1.1 Certification','Structural welding instruction toward AWS D1.1 certification.','Federal_Grants'),
    ('Heavy Equipment Simulator Introduction','Introductory heavy equipment operation via simulator.','Inmate_Welfare_Funds'),
    ('48-Week Offender Program','Long-term cognitive-behavioral offender programming.','State_Grants'),
    ('Alaska Reentry Course','Reentry planning and life-skills curriculum.','State_Grants'),
    ('Anger Management','Skills to identify and manage anger constructively.','State_Grants'),
    ('Criminal Attitudes Program (CAP)','Cognitive program addressing criminal thinking patterns.','State_Grants'),
    ('Parenting Classes','Parenting skills and family relationship building.','Nonprofit_Organizations'),
    ('Transformational Living Community (TLC)','Faith-based residential community for personal transformation.','Nonprofit_Organizations'),
    ('MentorNet / Chaplaincy Core Services','Chaplaincy mentoring and core faith-based services.','Nonprofit_Organizations'),
    ('Sex Offender Assessments','Clinical assessment services for sex offenders.','State_Grants'),
    ('Outpatient Sex Offender Treatment','Outpatient treatment program for sex offenders.','State_Grants'),
    ('Batterer''s Intervention Program','Intervention program addressing domestic violence behavior.','State_Grants')
) AS p(name, descr, funding);

INSERT INTO program_types (program_type, program_id)
SELECT t.ptype::program_type, pr.id
FROM (VALUES
    ('12-Step Recovery Meetings','Therapeutic'),
    ('Residential Substance Abuse Treatment (RSAT)','Therapeutic'),
    ('Residential Substance Abuse Treatment (RSAT)','Mental_Health_Behavioral'),
    ('Adult Basic Education (ABE)','Educational'),
    ('Computer Lab','Educational'),('Computer Lab','Vocational'),
    ('General Education Diploma (GED) Classes and Testing','Educational'),
    ('Post-Secondary Academic Services','Educational'),
    ('Alaska Dept. of Environmental Conservation Safe Food Handler Program','Vocational'),
    ('Alaska Food Worker Card','Vocational'),
    ('Keytrain / WorkKeys','Vocational'),('Keytrain / WorkKeys','Educational'),
    ('NCCER Introduction to Construction Trades','Vocational'),
    ('Small Engine Repair','Vocational'),
    ('USDOL Apprenticeship - Electrical','Vocational'),
    ('USDOL Apprenticeship - Building Maintenance','Vocational'),
    ('USDOL Apprenticeship - Plumbing','Vocational'),
    ('Welding AWS D1.1 Certification','Vocational'),
    ('Heavy Equipment Simulator Introduction','Vocational'),
    ('48-Week Offender Program','Therapeutic'),('48-Week Offender Program','Life_Skills'),
    ('Alaska Reentry Course','Re-Entry'),('Alaska Reentry Course','Life_Skills'),
    ('Anger Management','Mental_Health_Behavioral'),('Anger Management','Life_Skills'),
    ('Criminal Attitudes Program (CAP)','Therapeutic'),('Criminal Attitudes Program (CAP)','Mental_Health_Behavioral'),
    ('Parenting Classes','Life_Skills'),
    ('Transformational Living Community (TLC)','Religious_Faith-Based'),('Transformational Living Community (TLC)','Life_Skills'),
    ('MentorNet / Chaplaincy Core Services','Religious_Faith-Based'),
    ('Sex Offender Assessments','Therapeutic'),('Sex Offender Assessments','Mental_Health_Behavioral'),
    ('Outpatient Sex Offender Treatment','Therapeutic'),('Outpatient Sex Offender Treatment','Mental_Health_Behavioral'),
    ('Batterer''s Intervention Program','Therapeutic'),('Batterer''s Intervention Program','Mental_Health_Behavioral')
) AS t(name, ptype)
JOIN programs pr ON pr.name = t.name;

INSERT INTO program_credit_types (credit_type, program_id)
SELECT c.ctype::credit_type, pr.id
FROM (VALUES
    ('12-Step Recovery Meetings','Participation'),
    ('Residential Substance Abuse Treatment (RSAT)','Completion'),('Residential Substance Abuse Treatment (RSAT)','Participation'),
    ('Adult Basic Education (ABE)','Participation'),
    ('Computer Lab','Participation'),
    ('General Education Diploma (GED) Classes and Testing','Completion'),('General Education Diploma (GED) Classes and Testing','Education'),
    ('Post-Secondary Academic Services','Education'),
    ('Alaska Dept. of Environmental Conservation Safe Food Handler Program','Completion'),
    ('Alaska Food Worker Card','Completion'),
    ('Keytrain / WorkKeys','Completion'),
    ('NCCER Introduction to Construction Trades','Completion'),
    ('Small Engine Repair','Completion'),('Small Engine Repair','Participation'),
    ('USDOL Apprenticeship - Electrical','Earned-time'),('USDOL Apprenticeship - Electrical','Completion'),
    ('USDOL Apprenticeship - Building Maintenance','Earned-time'),('USDOL Apprenticeship - Building Maintenance','Completion'),
    ('USDOL Apprenticeship - Plumbing','Earned-time'),('USDOL Apprenticeship - Plumbing','Completion'),
    ('Welding AWS D1.1 Certification','Completion'),
    ('Heavy Equipment Simulator Introduction','Participation'),
    ('48-Week Offender Program','Completion'),('48-Week Offender Program','Participation'),
    ('Alaska Reentry Course','Completion'),
    ('Anger Management','Completion'),
    ('Criminal Attitudes Program (CAP)','Completion'),
    ('Parenting Classes','Participation'),
    ('Transformational Living Community (TLC)','Participation'),
    ('MentorNet / Chaplaincy Core Services','Participation'),
    ('Sex Offender Assessments','Completion'),
    ('Outpatient Sex Offender Treatment','Completion'),('Outpatient Sex Offender Treatment','Participation'),
    ('Batterer''s Intervention Program','Completion')
) AS c(name, ctype)
JOIN programs pr ON pr.name = c.name;

-- ===========================================================================
-- PHASE 5. Facility-program links
--   PCC: all 26 with owner labels. Non-PCC: ABE, 12-Step, Computer Lab, CAP
--   for all; NCCER only where offers_nccer.
-- ===========================================================================
INSERT INTO facilities_programs (program_id, facility_id, program_owner, created_at, updated_at)
SELECT pr.id, f.id, o.owner, now(), now()
FROM (SELECT id FROM facilities WHERE name = 'Palmer Correctional Center') f
CROSS JOIN (VALUES
    ('12-Step Recovery Meetings','AK DOC Behavioral Health'),
    ('Residential Substance Abuse Treatment (RSAT)','AK DOC Behavioral Health'),
    ('Adult Basic Education (ABE)','PCC Education Services'),
    ('Computer Lab','PCC Education Services'),
    ('General Education Diploma (GED) Classes and Testing','PCC Education Services'),
    ('Post-Secondary Academic Services','PCC Education Services'),
    ('Alaska Dept. of Environmental Conservation Safe Food Handler Program','PCC Vocational Department'),
    ('Alaska Food Worker Card','PCC Vocational Department'),
    ('Keytrain / WorkKeys','PCC Vocational Department'),
    ('NCCER Introduction to Construction Trades','PCC Vocational Department'),
    ('Small Engine Repair','PCC Vocational Department'),
    ('USDOL Apprenticeship - Electrical','PCC Vocational Department'),
    ('USDOL Apprenticeship - Building Maintenance','PCC Vocational Department'),
    ('USDOL Apprenticeship - Plumbing','PCC Vocational Department'),
    ('Welding AWS D1.1 Certification','PCC Vocational Department'),
    ('Heavy Equipment Simulator Introduction','PCC Vocational Department'),
    ('48-Week Offender Program','AK DOC Reentry Programs'),
    ('Alaska Reentry Course','AK DOC Reentry Programs'),
    ('Anger Management','AK DOC Reentry Programs'),
    ('Criminal Attitudes Program (CAP)','AK DOC Reentry Programs'),
    ('Parenting Classes','AK DOC Reentry Programs'),
    ('Transformational Living Community (TLC)','PCC Chaplaincy Services'),
    ('MentorNet / Chaplaincy Core Services','PCC Chaplaincy Services'),
    ('Sex Offender Assessments','AK DOC Treatment Services'),
    ('Outpatient Sex Offender Treatment','AK DOC Treatment Services'),
    ('Batterer''s Intervention Program','AK DOC Treatment Services')
) AS o(name, owner)
JOIN programs pr ON pr.name = o.name;

-- Non-PCC facility programs.
INSERT INTO facilities_programs (program_id, facility_id, program_owner, created_at, updated_at)
SELECT pr.id, fa.id, 'AK DOC', now(), now()
FROM fac_seed fs
JOIN facilities fa ON fa.name = fs.name
JOIN programs pr ON pr.name IN (
        'Adult Basic Education (ABE)',
        '12-Step Recovery Meetings',
        'Computer Lab',
        'Criminal Attitudes Program (CAP)')
   OR (pr.name = 'NCCER Introduction to Construction Trades' AND fs.offers_nccer);

-- ===========================================================================
-- PHASE 6. PCC classes (18) -- staging drives classes, events, overrides,
--          attendance. start/end are day offsets from CURRENT_DATE.
--          start_hhmm = local (America/Anchorage) wall-clock HHMM.
-- ===========================================================================
CREATE TEMP TABLE pcc_class_seed (
    class_name text,          -- the CLASS: the certificate. Several rows share one.
    cohort_name text,         -- the COHORT: one run of that class.
    program_name text, room_name text, capacity bigint,
    start_off int, end_off int, status text, credit_hours bigint,
    instructor_username text, dows int[], start_hhmm text, duration text, scheduled_minutes int
) ON COMMIT DROP;
INSERT INTO pcc_class_seed VALUES
-- Active (10)
('NCCER Construction Trades','NCCER Construction Trades — Spring','NCCER Introduction to Construction Trades','Vocational Shop',20,-60,120,'Active',80,'rosa.mayer',ARRAY[1,3,5],'1500','2h0m0s',120),
('Welding AWS D1.1','Welding AWS D1.1 — Active','Welding AWS D1.1 Certification','Vocational Shop',15,-30,90,'Active',120,'rosa.mayer',ARRAY[1,2,3,4,5],'1500','2h0m0s',120),
('Electrical Apprenticeship','Electrical Apprenticeship — Year 1','USDOL Apprenticeship - Electrical','Vocational Shop',12,-90,210,'Active',144,'rosa.mayer',ARRAY[1,2,3,4,5],'1500','3h0m0s',180),
('ABE Reading & Math','ABE — Current Session','Adult Basic Education (ABE)','Classroom A',25,-150,30,'Active',60,'chris.santillan',ARRAY[1,3,5],'1800','1h30m0s',90),
('General Education Diploma (GED)','GED Classes — Current','General Education Diploma (GED) Classes and Testing','Classroom A',20,-150,30,'Active',60,'chris.santillan',ARRAY[1,3,5],'1800','1h30m0s',90),
('RSAT Phase I','RSAT — Current Cohort','Residential Substance Abuse Treatment (RSAT)','Substance Abuse Treatment Room',15,-60,120,'Active',NULL,'andria.robers',ARRAY[1,2,3,4,5],'2000','2h0m0s',120),
('AA/NA Open Meeting','12-Step Recovery Meetings — Ongoing','12-Step Recovery Meetings','Substance Abuse Treatment Room',30,-150,210,'Active',NULL,'andria.robers',ARRAY[1,3,5],'2000','1h0m0s',60),
('Cognitive Restructuring Core','48-Week Offender Program — Current Cohort','48-Week Offender Program','Classroom A',20,-180,150,'Active',NULL,'pcc.education.coordinator',ARRAY[2,4],'2200','2h0m0s',120),
('Reentry Planning Workshop','Alaska Reentry Course — Current','Alaska Reentry Course','Classroom A',20,-60,30,'Active',NULL,'pcc.education.coordinator',ARRAY[2,4],'2200','1h30m0s',90),
('TLC Core Curriculum','Transformational Living Community — Ongoing','Transformational Living Community (TLC)','Chapel / TLC Room',25,-150,210,'Active',NULL,'michael.dintaman',ARRAY[3],'2200','1h30m0s',90),
-- Completed (4)
('Small Engine Repair Certification','Small Engine Repair — Winter','Small Engine Repair','Small Engine Repair Shop',15,-150,-60,'Completed',40,'rosa.mayer',ARRAY[1,3,5],'1500','2h0m0s',120),
('Anger Management Group','Anger Management — Session 1','Anger Management','Counseling Room',20,-150,-90,'Completed',NULL,'pcc.education.coordinator',ARRAY[2,4],'2200','1h30m0s',90),
('CAP Core Curriculum','CAP — Cohort 1','Criminal Attitudes Program (CAP)','Classroom A',20,-150,-60,'Completed',NULL,'pcc.education.coordinator',ARRAY[2,4],'2200','2h0m0s',120),
-- GED Testing is a SECOND COHORT of the GED class above (Completed + Active siblings).
('General Education Diploma (GED)','GED Testing — Winter','General Education Diploma (GED) Classes and Testing','Classroom A',20,-150,-90,'Completed',60,'chris.santillan',ARRAY[1,3,5],'1800','1h30m0s',90),
-- Scheduled (4)
('Plumbing Apprenticeship','Plumbing Apprenticeship — Upcoming','USDOL Apprenticeship - Plumbing','Vocational Shop',12,35,217,'Scheduled',144,'rosa.mayer',ARRAY[1,2,3,4,5],'1500','3h0m0s',180),
('Computer Literacy Basics','Computer Lab — Summer Session','Computer Lab','Computer Lab',20,14,98,'Scheduled',NULL,'chris.santillan',ARRAY[1,3,5],'1800','1h0m0s',60),
('Parenting Inside Out','Parenting Classes — Upcoming','Parenting Classes','Classroom A',20,14,98,'Scheduled',NULL,'pcc.education.coordinator',ARRAY[2,4],'2200','1h30m0s',90),
('WorkKeys Assessment Prep','Keytrain/WorkKeys — Upcoming','Keytrain / WorkKeys','Computer Lab',20,35,154,'Scheduled',NULL,'chris.santillan',ARRAY[1,3,5],'1800','1h30m0s',90),
-- --------------------------------------------------------------------------
-- Extra sibling cohorts, so the Classes tab has something to roll up.
-- Each pairs with a NON-Active sibling above -- see the header warning.
-- --------------------------------------------------------------------------
('Anger Management Group','Anger Management — Session 2','Anger Management','Counseling Room',20,-30,90,'Active',NULL,'pcc.education.coordinator',ARRAY[2,4],'1800','1h30m0s',90),
('CAP Core Curriculum','CAP — Cohort 2','Criminal Attitudes Program (CAP)','Classroom A',20,-45,105,'Active',NULL,'pcc.education.coordinator',ARRAY[2,4],'1500','2h0m0s',120),
('Small Engine Repair Certification','Small Engine Repair — Spring','Small Engine Repair','Small Engine Repair Shop',15,21,140,'Scheduled',40,'rosa.mayer',ARRAY[2,4],'1500','2h0m0s',120);

-- The CLASS tier: one row per distinct (program, facility, class_name).
INSERT INTO program_classes (program_id, facility_id, name, description, credit_hours, created_at, updated_at)
SELECT DISTINCT ON (pr.id, f.id, s.class_name)
       pr.id, f.id, s.class_name, pr.description, s.credit_hours, now(), now()
FROM pcc_class_seed s
JOIN programs pr ON pr.name = s.program_name
CROSS JOIN (SELECT id FROM facilities WHERE name = 'Palmer Correctional Center') f
ORDER BY pr.id, f.id, s.class_name, s.credit_hours NULLS LAST;

-- The COHORTS, each pointed at its class. A cohort has NO name -- id751 dropped the
-- column. cohort_name above survives only as a label inside this script.
INSERT INTO program_class_cohorts (class_id, program_id, facility_id, capacity, description, start_dt, end_dt, status, credit_hours, created_at, updated_at)
SELECT pc.id, pr.id, f.id, s.capacity, pr.description,
       CURRENT_DATE + s.start_off, CURRENT_DATE + s.end_off, s.status::class_status, s.credit_hours, now(), now()
FROM pcc_class_seed s
JOIN programs pr ON pr.name = s.program_name
CROSS JOIN (SELECT id FROM facilities WHERE name = 'Palmer Correctional Center') f
JOIN program_classes pc ON pc.program_id = pr.id AND pc.facility_id = f.id AND pc.name = s.class_name;

-- ⚠️  Every later phase used to re-find a cohort by `c.name = s.cohort_name`. With no name
--     column there is nothing to join on, so resolve each seed row to its cohort id ONCE,
--     here, and join through this map afterwards.
--
--     The key is (class_id, status). That is unique because sibling cohorts of one class
--     always pair an Active with a Completed or Scheduled one -- the same invariant the
--     header already requires, since two Active siblings abort the seed on the
--     concurrent-enrollment index. (start_dt would NOT work: GED's two cohorts both start
--     at offset -150.) The UNIQUE below turns a violation into a loud failure here rather
--     than silently duplicated events and attendance downstream.
CREATE TEMP TABLE pcc_cohort_map (cohort_name text PRIMARY KEY, cohort_id bigint UNIQUE) ON COMMIT DROP;
INSERT INTO pcc_cohort_map (cohort_name, cohort_id)
SELECT s.cohort_name, c.id
FROM pcc_class_seed s
JOIN programs pr ON pr.name = s.program_name
CROSS JOIN (SELECT id FROM facilities WHERE name = 'Palmer Correctional Center') f
JOIN program_classes pc ON pc.program_id = pr.id AND pc.facility_id = f.id AND pc.name = s.class_name
JOIN program_class_cohorts c ON c.class_id = pc.id AND c.status = s.status::class_status;

INSERT INTO program_class_events (cohort_id, duration, recurrence_rule, room_id, instructor_id, is_cancelled, created_at, updated_at)
SELECT c.id, s.duration,
    'DTSTART;TZID=America/Anchorage:' || to_char(c.start_dt, 'YYYYMMDD') || 'T' || s.start_hhmm || '00' || E'\n' ||
    'RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=' ||
        (SELECT string_agg(m.code, ',' ORDER BY m.n)
           FROM unnest(s.dows) AS dow
           JOIN (VALUES (0,'SU'),(1,'MO'),(2,'TU'),(3,'WE'),(4,'TH'),(5,'FR'),(6,'SA')) AS m(n, code) ON m.n = dow) ||
        ';UNTIL=' || to_char(c.end_dt, 'YYYYMMDD') || 'T235959Z',
    rm.id, instr.id, false, now(), now()
FROM pcc_class_seed s
JOIN pcc_cohort_map m ON m.cohort_name = s.cohort_name
JOIN program_class_cohorts c ON c.id = m.cohort_id
JOIN rooms rm ON rm.name = s.room_name
            AND rm.facility_id = (SELECT id FROM facilities WHERE name = 'Palmer Correctional Center')
JOIN users instr ON instr.username = s.instructor_username;

-- ===========================================================================
-- PHASE 7. Cancelled session overrides (PCC active classes: 3rd & 7th past occ)
-- ===========================================================================
CREATE TEMP TABLE _cancelled (event_id int, d date) ON COMMIT DROP;

WITH occ AS (
    SELECT c.id AS cohort_id, ev.id AS event_id, s.start_hhmm, s.duration,
           gs::date AS d,
           row_number() OVER (PARTITION BY c.id ORDER BY gs) AS rn
    FROM pcc_class_seed s
    JOIN pcc_cohort_map m ON m.cohort_name = s.cohort_name AND s.status = 'Active'
    JOIN program_class_cohorts c ON c.id = m.cohort_id
    JOIN program_class_events ev ON ev.cohort_id = c.id
    CROSS JOIN LATERAL generate_series(c.start_dt, LEAST(c.end_dt, CURRENT_DATE - 1), interval '1 day') gs
    WHERE extract(dow FROM gs) = ANY(s.dows)
),
picked AS (SELECT * FROM occ WHERE rn IN (3, 7)),
ins AS (
    INSERT INTO program_class_event_overrides (event_id, duration, override_rrule, is_cancelled, reason, created_at, updated_at)
    SELECT p.event_id, p.duration,
        'DTSTART;TZID=America/Anchorage:' || to_char(p.d, 'YYYYMMDD') || 'T' || p.start_hhmm || '00' || E'\n' || 'RRULE:FREQ=DAILY;COUNT=1',
        true,
        (ARRAY['Facility lockdown','Instructor illness','Room maintenance','Holiday observance'])[(p.rn % 4) + 1],
        now(), now()
    FROM picked p
    RETURNING 1
)
INSERT INTO _cancelled (event_id, d) SELECT event_id, d FROM picked;

-- ===========================================================================
-- PHASE 8. PCC enrollments
--   Active: 12 residents (Enrolled). Concern residents (rn 1,2) in ALL active.
--           NCCER Spring = exactly residents 1..12 (excludes Wendell rn28).
--   Completed: 8 residents -> first 6 Completed, 7th Withdrawn, 8th Dropped.
--   Scheduled: residents 5..10 (Enrolled).
-- ===========================================================================
INSERT INTO program_class_enrollments (cohort_id, class_id, user_id, enrollment_status, enrolled_at, enrollment_ended_at, created_at, updated_at)
WITH res AS (
    SELECT id, row_number() OVER (ORDER BY doc_id) AS rn
    FROM users
    WHERE role = 'student' AND facility_id = (SELECT id FROM facilities WHERE name = 'Palmer Correctional Center')
),
acl AS (
    SELECT c.id AS cohort_id, c.class_id, m.cohort_name, c.start_dt, c.end_dt, s.status,
           row_number() OVER (ORDER BY c.id) AS k
    FROM program_class_cohorts c
    JOIN pcc_cohort_map m ON m.cohort_id = c.id
    JOIN pcc_class_seed s ON s.cohort_name = m.cohort_name
)
SELECT acl.cohort_id, acl.class_id, r.id,
    CASE
        WHEN acl.status = 'Completed' THEN
            CASE WHEN r.rn <= 6 THEN 'Completed'
                 WHEN r.rn = 7 THEN 'Incomplete: Withdrawn'
                 ELSE 'Incomplete: Dropped' END
        ELSE 'Enrolled'
    END,
    acl.start_dt::timestamptz,
    CASE WHEN acl.status = 'Completed' THEN acl.end_dt::timestamptz ELSE NULL END,
    now(), now()
FROM acl
JOIN res r ON (
    CASE
        -- NCCER Spring: exactly residents 1..12 (includes concern targets 1,2; excludes Wendell rn28)
        WHEN acl.cohort_name = 'NCCER Construction Trades — Spring' THEN r.rn <= 12
        -- Other active: concern targets 1,2 always, plus a rotating ~10 per class
        WHEN acl.status = 'Active'    THEN r.rn IN (1, 2) OR ((r.rn + acl.k * 3) % 30) < 10
        -- Completed: residents 1..8 (1..6 Completed, 7 Withdrawn, 8 Dropped)
        WHEN acl.status = 'Completed' THEN r.rn <= 8
        -- Scheduled: residents 5..10 (pre-enroll; excludes concern targets)
        ELSE r.rn BETWEEN 5 AND 10
    END
);

-- ===========================================================================
-- PHASE 9. PCC attendance
--   Active: occurrences in last 60 days (past only), minus cancelled sessions.
--   Completed: full window (withdrawn/dropped limited to first 35 days).
--   Distribution 75/10/10/5. Concern residents (AK00001/AK00002) forced
--   Absent_Unexcused for sessions in the last 14 days.
-- ===========================================================================
INSERT INTO program_class_event_attendance
    (event_id, user_id, date, attendance_status, note, reason_category, minutes_attended, scheduled_minutes, created_at, updated_at)
WITH cls AS (
    SELECT c.id AS cohort_id, c.start_dt, c.end_dt, s.status, s.dows, s.scheduled_minutes, ev.id AS event_id
    FROM program_class_cohorts c
    JOIN pcc_cohort_map m ON m.cohort_id = c.id
    JOIN pcc_class_seed s ON s.cohort_name = m.cohort_name AND s.status IN ('Active','Completed')
    JOIN program_class_events ev ON ev.cohort_id = c.id
),
sess AS (
    SELECT cls.*, gs::date AS d
    FROM cls
    CROSS JOIN LATERAL generate_series(
        CASE WHEN cls.status = 'Active' THEN GREATEST(cls.start_dt, CURRENT_DATE - 60) ELSE cls.start_dt END,
        CASE WHEN cls.status = 'Active' THEN CURRENT_DATE - 1 ELSE LEAST(cls.end_dt, CURRENT_DATE - 1) END,
        interval '1 day') gs
    WHERE extract(dow FROM gs) = ANY(cls.dows)
),
calc AS (
    SELECT se.event_id, e.user_id, se.d, se.scheduled_minutes, e.enrollment_status, se.start_dt, u.doc_id,
        (abs(hashtext(e.user_id::text || '-' || se.d::text)) % 100) AS pct,
        (u.doc_id IN ('AK00001','AK00002') AND se.d >= CURRENT_DATE - 14) AS forced
    FROM sess se
    JOIN program_class_enrollments e ON e.cohort_id = se.cohort_id
    JOIN users u ON u.id = e.user_id
    LEFT JOIN _cancelled cx ON cx.event_id = se.event_id AND cx.d = se.d
    WHERE cx.event_id IS NULL
      AND (e.enrollment_status IN ('Enrolled','Completed') OR se.d <= se.start_dt + 35)
)
SELECT event_id, user_id, to_char(d, 'YYYY-MM-DD'),
    st,
    CASE st WHEN 'absent_excused' THEN (ARRAY['Medical appointment','Legal/court appointment','Approved program conflict'])[(pct % 3) + 1]
            WHEN 'absent_unexcused' THEN 'No show' ELSE '' END,
    CASE st WHEN 'absent_excused' THEN (ARRAY['Medical','Legal','Scheduling'])[(pct % 3) + 1]
            WHEN 'absent_unexcused' THEN 'Disciplinary' ELSE '' END,
    CASE st WHEN 'present' THEN scheduled_minutes WHEN 'partial' THEN scheduled_minutes / 2 ELSE 0 END,
    scheduled_minutes, d::timestamptz, d::timestamptz
FROM (
    SELECT *, CASE
        WHEN forced THEN 'absent_unexcused'
        WHEN pct < 75 THEN 'present'
        WHEN pct < 85 THEN 'partial'
        WHEN pct < 95 THEN 'absent_excused'
        ELSE 'absent_unexcused' END AS st
    FROM calc
) q;

-- ===========================================================================
-- PHASE 10. PCC program completions (one per Completed-status completed enroll)
-- ===========================================================================
-- The certificate is per (user, CLASS). ON CONFLICT DO NOTHING because two Completed
-- cohorts of one class would otherwise violate class_completions_user_class_uniq --
-- no seed row does that today, but the guard means adding one is not a landmine.
INSERT INTO class_completions
    (user_id, cohort_id, class_id, facility_name, credit_type, admin_email, program_owner,
     program_name, program_id, class_name, cohort_start_dt, enrolled_on_dt, created_at, updated_at)
SELECT e.user_id, c.id, c.class_id, f.name, 'Completion', 'carolina.alisio@alaska.unlocked.v2', fp.program_owner,
       pr.name, pr.id, cl.name, c.start_dt::timestamptz, e.enrolled_at, now(), now()
FROM program_class_enrollments e
JOIN program_class_cohorts c ON c.id = e.cohort_id
JOIN program_classes cl ON cl.id = c.class_id
JOIN pcc_cohort_map m ON m.cohort_id = c.id
JOIN pcc_class_seed s ON s.cohort_name = m.cohort_name AND s.status = 'Completed'
JOIN programs pr ON pr.id = c.program_id
JOIN facilities_programs fp ON fp.program_id = pr.id AND fp.facility_id = c.facility_id
CROSS JOIN (SELECT id, name FROM facilities WHERE name = 'Palmer Correctional Center') f
WHERE e.enrollment_status = 'Completed'
ON CONFLICT DO NOTHING;

-- ===========================================================================
-- PHASE 11. Skeleton classes for non-PCC facilities (up to 5 templates each)
-- ===========================================================================
CREATE TEMP TABLE skel_tmpl (
    class_name text,          -- the CLASS. Not facility-prefixed: a class IS facility-scoped.
    tmpl_name text,           -- suffix used to build the COHORT name.
    program_name text, status text, room_name text,
    dows int[], start_hhmm text, duration text, scheduled_minutes int, requires_nccer boolean
) ON COMMIT DROP;
INSERT INTO skel_tmpl VALUES
    ('ABE Reading & Math',                  'ABE — Completed',        'Adult Basic Education (ABE)',                'Completed','Classroom A',      ARRAY[1,3,5],'1800','1h30m0s',90, false),
    ('AA/NA Open Meeting',                  '12-Step — Completed',    '12-Step Recovery Meetings',                  'Completed','Multipurpose Room',ARRAY[1,3,5],'2200','1h0m0s', 60, false),
    ('Computer Literacy Basics',            'Computer Lab — Active',  'Computer Lab',                               'Active',   'Computer Lab',     ARRAY[1,3,5],'2000','1h0m0s', 60, false),
    ('CAP Core Curriculum',                 'CAP — Active',           'Criminal Attitudes Program (CAP)',           'Active',   'Classroom A',      ARRAY[2,4],  '2000','2h0m0s', 120,false),
    ('NCCER Construction Trades',           'NCCER — Active',         'NCCER Introduction to Construction Trades',  'Active',   'Multipurpose Room',ARRAY[1,3,5],'1500','2h0m0s', 120,true);

-- Skeleton CLASS tier (one per facility+template; satellites stay 1 cohort each).
INSERT INTO program_classes (program_id, facility_id, name, description, credit_hours, created_at, updated_at)
SELECT pr.id, fa.id, t.class_name, pr.description, NULL, now(), now()
FROM fac_seed fs
JOIN facilities fa ON fa.name = fs.name
JOIN skel_tmpl t ON (NOT t.requires_nccer OR fs.offers_nccer)
JOIN programs pr ON pr.name = t.program_name;

-- Skeleton cohorts (start/end relative; active offset varies per facility idx).
INSERT INTO program_class_cohorts (class_id, program_id, facility_id, capacity, description, start_dt, end_dt, status, credit_hours, created_at, updated_at)
SELECT pc.id, pr.id, fa.id, 20,
       pr.description,
       CASE WHEN t.status = 'Completed' THEN CURRENT_DATE - 150
            ELSE CURRENT_DATE - (120 - (fs.idx % 4) * 10) END,
       CASE WHEN t.status = 'Completed' THEN CURRENT_DATE - 60
            ELSE CURRENT_DATE + 210 END,
       t.status::class_status, NULL, now(), now()
FROM fac_seed fs
JOIN facilities fa ON fa.name = fs.name
JOIN skel_tmpl t ON (NOT t.requires_nccer OR fs.offers_nccer)
JOIN programs pr ON pr.name = t.program_name
JOIN program_classes pc ON pc.facility_id = fa.id AND pc.program_id = pr.id AND pc.name = t.class_name;

-- Skeleton events.
INSERT INTO program_class_events (cohort_id, duration, recurrence_rule, room_id, instructor_id, is_cancelled, created_at, updated_at)
SELECT c.id, t.duration,
    'DTSTART;TZID=America/Anchorage:' || to_char(c.start_dt, 'YYYYMMDD') || 'T' || t.start_hhmm || '00' || E'\n' ||
    'RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=' ||
        (SELECT string_agg(m.code, ',' ORDER BY m.n)
           FROM unnest(t.dows) AS dow
           JOIN (VALUES (0,'SU'),(1,'MO'),(2,'TU'),(3,'WE'),(4,'TH'),(5,'FR'),(6,'SA')) AS m(n, code) ON m.n = dow) ||
        ';UNTIL=' || to_char(c.end_dt, 'YYYYMMDD') || 'T235959Z',
    rm.id, staff.id, false, now(), now()
FROM fac_seed fs
JOIN facilities fa ON fa.name = fs.name
JOIN skel_tmpl t ON (NOT t.requires_nccer OR fs.offers_nccer)
JOIN programs pr ON pr.name = t.program_name
JOIN program_classes pc ON pc.facility_id = fa.id AND pc.program_id = pr.id AND pc.name = t.class_name
JOIN program_class_cohorts c ON c.facility_id = fa.id AND c.class_id = pc.id
JOIN rooms rm ON rm.facility_id = fa.id AND rm.name = t.room_name
JOIN users staff ON staff.username = fs.key || '.education.staff';

-- Skeleton enrollments (completed: 4-7 Completed; active: 3-10 Enrolled).
INSERT INTO program_class_enrollments (cohort_id, class_id, user_id, enrollment_status, enrolled_at, enrollment_ended_at, created_at, updated_at)
WITH skel_cls AS (
    SELECT c.id AS cohort_id, c.class_id, c.facility_id, c.start_dt, c.end_dt, c.status,
           fs.idx,
           CASE WHEN c.status = 'Completed' THEN 4 + (fs.idx % 4) ELSE 3 + (fs.idx % 8) END AS enroll_count
    FROM program_class_cohorts c
    JOIN facilities fa ON fa.id = c.facility_id
    JOIN fac_seed fs ON fs.name = fa.name
),
fac_res AS (
    SELECT id, facility_id, row_number() OVER (PARTITION BY facility_id ORDER BY doc_id) AS rn
    FROM users WHERE role = 'student'
)
SELECT sc.cohort_id, sc.class_id, r.id,
    CASE WHEN sc.status = 'Completed' THEN 'Completed' ELSE 'Enrolled' END,
    sc.start_dt::timestamptz,
    CASE WHEN sc.status = 'Completed' THEN sc.end_dt::timestamptz ELSE NULL END,
    now(), now()
FROM skel_cls sc
JOIN fac_res r ON r.facility_id = sc.facility_id AND r.rn <= sc.enroll_count;

-- Skeleton attendance (base present rate 65-80% per facility id; concern target
-- = first resident per facility forced Absent_Unexcused in last 14 days).
INSERT INTO program_class_event_attendance
    (event_id, user_id, date, attendance_status, note, reason_category, minutes_attended, scheduled_minutes, created_at, updated_at)
WITH cls AS (
    SELECT c.id AS cohort_id, c.facility_id, c.start_dt, c.end_dt, c.status, t.dows, t.scheduled_minutes, ev.id AS event_id,
           (65 + (c.facility_id % 16)) AS base_rate
    FROM program_class_cohorts c
    JOIN facilities fa ON fa.id = c.facility_id
    JOIN fac_seed fs ON fs.name = fa.name
    JOIN program_classes pc ON pc.id = c.class_id
    JOIN skel_tmpl t ON t.class_name = pc.name
    JOIN program_class_events ev ON ev.cohort_id = c.id
),
sess AS (
    SELECT cls.*, gs::date AS d
    FROM cls
    CROSS JOIN LATERAL generate_series(
        CASE WHEN cls.status = 'Active' THEN GREATEST(cls.start_dt, CURRENT_DATE - 60) ELSE cls.start_dt END,
        CASE WHEN cls.status = 'Active' THEN CURRENT_DATE - 1 ELSE LEAST(cls.end_dt, CURRENT_DATE - 1) END,
        interval '1 day') gs
    WHERE extract(dow FROM gs) = ANY(cls.dows)
),
fac_res AS (
    SELECT id, facility_id, row_number() OVER (PARTITION BY facility_id ORDER BY doc_id) AS rn
    FROM users WHERE role = 'student'
),
calc AS (
    SELECT se.event_id, e.user_id, se.d, se.scheduled_minutes, se.base_rate,
        (abs(hashtext(e.user_id::text || '-' || se.d::text)) % 100) AS pct,
        (fr.rn = 1 AND se.status = 'Active' AND se.d >= CURRENT_DATE - 14) AS forced
    FROM sess se
    JOIN program_class_enrollments e ON e.cohort_id = se.cohort_id
    JOIN fac_res fr ON fr.id = e.user_id
)
SELECT event_id, user_id, to_char(d, 'YYYY-MM-DD'),
    st,
    CASE st WHEN 'absent_excused' THEN (ARRAY['Medical appointment','Legal/court appointment','Approved program conflict'])[(pct % 3) + 1]
            WHEN 'absent_unexcused' THEN 'No show' ELSE '' END,
    CASE st WHEN 'absent_excused' THEN (ARRAY['Medical','Legal','Scheduling'])[(pct % 3) + 1]
            WHEN 'absent_unexcused' THEN 'Disciplinary' ELSE '' END,
    CASE st WHEN 'present' THEN scheduled_minutes WHEN 'partial' THEN scheduled_minutes / 2 ELSE 0 END,
    scheduled_minutes, d::timestamptz, d::timestamptz
FROM (
    SELECT *, CASE
        WHEN forced THEN 'absent_unexcused'
        WHEN pct < base_rate THEN 'present'
        WHEN pct < base_rate + 10 THEN 'partial'
        WHEN pct < base_rate + 18 THEN 'absent_excused'
        ELSE 'absent_unexcused' END AS st
    FROM calc
) q;

-- ===========================================================================
-- Summary
-- ===========================================================================
\echo ''
\echo '================ Alaska seed summary ================'
SELECT 'facilities'   AS item, count(*) FROM facilities
UNION ALL SELECT 'rooms',        count(*) FROM rooms
UNION ALL SELECT 'users total',  count(*) FROM users
UNION ALL SELECT 'users (PCC)',  count(*) FROM users WHERE facility_id = (SELECT id FROM facilities WHERE name='Palmer Correctional Center')
UNION ALL SELECT 'programs',     count(*) FROM programs
UNION ALL SELECT 'facilities_programs', count(*) FROM facilities_programs
UNION ALL SELECT 'classes (tier)', count(*) FROM program_classes
UNION ALL SELECT 'cohorts',      count(*) FROM program_class_cohorts
UNION ALL SELECT 'multi-cohort classes', count(*) FROM (
    SELECT class_id FROM program_class_cohorts GROUP BY class_id HAVING count(*) > 1) m
UNION ALL SELECT 'events',       count(*) FROM program_class_events
UNION ALL SELECT 'cancelled overrides', count(*) FROM program_class_event_overrides
UNION ALL SELECT 'enrollments',  count(*) FROM program_class_enrollments
UNION ALL SELECT 'attendance',   count(*) FROM program_class_event_attendance
UNION ALL SELECT 'completions',  count(*) FROM class_completions
ORDER BY item;

\echo ''
\echo '-- Checklist spot-checks --'
SELECT 'Marcus active enrollments' AS check, count(*)
  FROM program_class_enrollments e JOIN program_class_cohorts c ON c.id=e.cohort_id
  JOIN users u ON u.id=e.user_id WHERE u.doc_id='AK00002' AND c.status='Active';
SELECT 'Marcus completions' AS check, count(*)
  FROM class_completions pc JOIN users u ON u.id=pc.user_id WHERE u.doc_id='AK00002';
SELECT 'NCCER Spring enrolled (expect 12)' AS check, count(*)
  FROM program_class_enrollments e JOIN program_class_cohorts c ON c.id=e.cohort_id
  JOIN pcc_cohort_map m ON m.cohort_id=c.id
  WHERE m.cohort_name='NCCER Construction Trades — Spring';
SELECT 'Wendell in NCCER Spring (expect 0)' AS check, count(*)
  FROM program_class_enrollments e JOIN program_class_cohorts c ON c.id=e.cohort_id
  JOIN users u ON u.id=e.user_id JOIN pcc_cohort_map m ON m.cohort_id=c.id
  WHERE u.doc_id='AK00028' AND m.cohort_name='NCCER Construction Trades — Spring';

-- id751 invariants. Each of these fails LOUDLY rather than producing odd numbers later.
SELECT 'cohorts with no parent class (expect 0)' AS check, count(*)
  FROM program_class_cohorts WHERE class_id IS NULL;
SELECT 'enrollments whose class_id disagrees with their cohort (expect 0)' AS check, count(*)
  FROM program_class_enrollments e JOIN program_class_cohorts c ON c.id=e.cohort_id
  WHERE e.class_id <> c.class_id;
SELECT 'denormalization drift on cohorts (expect 0)' AS check, count(*)
  FROM program_class_cohorts c JOIN program_classes pc ON pc.id=c.class_id
  WHERE pc.program_id <> c.program_id OR pc.facility_id <> c.facility_id;
SELECT 'residents active in 2 cohorts of one class (expect 0)' AS check, count(*) FROM (
    SELECT user_id, class_id FROM program_class_enrollments
    WHERE enrollment_status='Enrolled' AND deleted_at IS NULL
    GROUP BY user_id, class_id HAVING count(*) > 1) d;

\echo ''
\echo '-- PCC classes that carry more than one cohort (the Classes tab rollups) --'
-- Cohorts have no name, so they are listed by the seed label that produced them --
-- which is exactly how an admin tells sibling runs apart on screen: status and dates.
SELECT pc.name AS class, count(c.*) AS cohorts,
       string_agg(m.cohort_name || ' [' || c.status || ']', ', ' ORDER BY m.cohort_name) AS cohort_list
  FROM program_classes pc
  JOIN program_class_cohorts c ON c.class_id = pc.id
  JOIN pcc_cohort_map m ON m.cohort_id = c.id
  WHERE pc.facility_id = (SELECT id FROM facilities WHERE name='Palmer Correctional Center')
  GROUP BY pc.name HAVING count(c.*) > 1 ORDER BY pc.name;
SELECT 'NCCER skeleton facilities w/ attendance (expect AMCC,GCCC,HMCC,SCCC)' AS check, fa.name, count(a.*)
  FROM program_class_cohorts c JOIN facilities fa ON fa.id=c.facility_id
  JOIN programs pr ON pr.id=c.program_id AND pr.name='NCCER Introduction to Construction Trades'
  JOIN program_class_events ev ON ev.cohort_id=c.id
  JOIN program_class_event_attendance a ON a.event_id=ev.id
  WHERE fa.name <> 'Palmer Correctional Center'
  GROUP BY fa.name ORDER BY fa.name;

COMMIT;

\echo ''
\echo 'Alaska demo seeded. NEXT: log in as a system_admin and Reset Password for'
\echo 'the login accounts: carolina.alisio, rich.salas (dept admins - need a'
\echo 'system_admin to reset), and PCC instructors rosa.mayer, chris.santillan,'
\echo 'andria.robers, michael.dintaman, pcc.education.coordinator,'
\echo 'vocational.instructor. Title-only/skeleton staff and residents stay DB-only.'
