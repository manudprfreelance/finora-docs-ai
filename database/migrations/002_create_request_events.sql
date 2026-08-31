CREATE TABLE IF NOT EXISTS request_events (
    id UUID PRIMARY KEY,

    request_id UUID NOT NULL,

    event_type TEXT NOT NULL,

    event_data JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_request_events_request
        FOREIGN KEY (request_id)
        REFERENCES request_sessions (id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_request_events_request_id
    ON request_events (request_id);

CREATE INDEX IF NOT EXISTS idx_request_events_event_type
    ON request_events (event_type);

CREATE INDEX IF NOT EXISTS idx_request_events_created_at
    ON request_events (created_at);