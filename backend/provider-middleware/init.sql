-- init.sql

BEGIN;
CREATE TABLE IF NOT EXISTS providers (
    facility_id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    api_key TEXT,
    username TEXT,
    password TEXT
);
COMMIT;
