CREATE TABLE portal_users (
 id TEXT PRIMARY KEY NOT NULL,
 identity_id TEXT UNIQUE NOT NULL,
 email TEXT NOT NULL,
 full_name TEXT NOT NULL,
 phone_number TEXT NOT NULL DEFAULT '',
 settings TEXT NOT NULL DEFAULT '{}'
);
--> statement-breakpoint
CREATE TABLE portal_records (
 id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
 user_id TEXT NOT NULL REFERENCES portal_users(id),
 kind TEXT NOT NULL,
 data TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX portal_records_owner_kind ON portal_records(user_id,kind);
