CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

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
    id UUID PRIMARY KEY,
    hash TEXT NOT NULL,
    filename TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS modules (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    file_id UUID NOT NULL,
    merkle_hash TEXT NOT NULL,
    hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS edges (
    id UUID PRIMARY KEY,
    from_id UUID NOT NULL,
    to_id UUID NOT NULL
);

CREATE TABLE IF NOT EXISTS commits (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL,
    commit_by UUID NOT NULL
);

CREATE TYPE edit_type AS ENUM ('update', 'add', 'disconnect', 'move');

CREATE TABLE IF NOT EXISTS edit_actions (
    id UUID PRIMARY KEY,
    commit_id TEXT NOT NULL,
    index_n INT NOT NULL,
    action edit_type NOT NULL,
    old_module UUID,
    new_module UUID,
    old_parent UUID,
    new_parent UUID
);
