CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
    uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    firstname TEXT NOT NULL,
    lastname TEXT NOT NULL,
    password TEXT NOT NULL,
    two_fa_secret TEXT,
    two_fa_time TIMESTAMP,
    verified BOOLEAN DEFAULT FALSE,
    cli_token TEXT
);

CREATE TABLE IF NOT EXISTS files (
    hash TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    last_change BIGINT,
    modules TEXT[]
);

CREATE TABLE IF NOT EXISTS edges (
    parent_module TEXT NOT NULL,
    --parent_module_file_hash TEXT NOT NULL,
    child_module TEXT NOT NULL
    --child_module_file_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS commits (
    commit_hash TEXT PRIMARY KEY,
    commit_by UUID REFERENCES users(uuid) ON DELETE SET NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    hashes TEXT[]
);
