CREATE TABLE IF NOT EXISTS firecam_users (
 id SERIAL PRIMARY KEY, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL,
 full_name TEXT NOT NULL, phone_number TEXT NOT NULL DEFAULT '', settings JSONB NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS firecam_sessions (
 token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES firecam_users(id) ON DELETE CASCADE, expires BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS firecam_records (
 id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES firecam_users(id) ON DELETE CASCADE,
 kind TEXT NOT NULL, data JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS firecam_records_owner ON firecam_records(user_id,kind);
CREATE TABLE IF NOT EXISTS firecam_rate_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at BIGINT NOT NULL);
