CREATE TABLE IF NOT EXISTS request_sessions (
    id UUID PRIMARY KEY,

    request_state JSONB NOT NULL,

    status TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_request_sessions_status
    ON request_sessions (status);

CREATE INDEX IF NOT EXISTS idx_request_sessions_updated_at
    ON request_sessions (updated_at);