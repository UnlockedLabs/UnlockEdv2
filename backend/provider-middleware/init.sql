-- init.sql

BEGIN;
CREATE TABLE IF NOT EXISTS providers (
    id INTEGER PRIMARY KEY,
    type TEXT NOT NULL,
    account_id TEXT NOT NULL,
    url TEXT NOT NULL,
    api_key TEXT,
    username TEXT,
    password TEXT
);
COMMIT;
