import { randomUUID } from "crypto";

import { postgresPool } from "@/lib/server/postgres";

export type RequestEventType =
  | "session_created"
  | "message_received"
  | "request_updated"
  | "request_ready_for_confirmation"
  | "request_confirmed"
  | "customer_change_rejected";

export interface RequestEvent {
  id: string;
  requestId: string;
  eventType: RequestEventType;
  eventData: Record<string, unknown>;
  createdAt: Date;
}

interface RequestEventRow {
  id: string;
  request_id: string;
  event_type: RequestEventType;
  event_data: Record<string, unknown>;
  created_at: Date;
}

function mapRequestEventRow(
  row: RequestEventRow,
): RequestEvent {
  return {
    id: row.id,
    requestId: row.request_id,
    eventType: row.event_type,
    eventData: row.event_data,
    createdAt: row.created_at,
  };
}

export async function createRequestEvent(
  requestId: string,
  eventType: RequestEventType,
  eventData: Record<string, unknown> = {},
): Promise<RequestEvent> {
  const id = randomUUID();

  const result =
    await postgresPool.query<RequestEventRow>(
      `
        INSERT INTO request_events (
          id,
          request_id,
          event_type,
          event_data
        )
        VALUES ($1, $2, $3, $4::jsonb)
        RETURNING
          id,
          request_id,
          event_type,
          event_data,
          created_at
      `,
      [
        id,
        requestId,
        eventType,
        JSON.stringify(eventData),
      ],
    );

  return mapRequestEventRow(
    result.rows[0],
  );
}

export async function getRequestEvents(
  requestId: string,
): Promise<RequestEvent[]> {
  const result =
    await postgresPool.query<RequestEventRow>(
      `
        SELECT
          id,
          request_id,
          event_type,
          event_data,
          created_at
        FROM request_events
        WHERE request_id = $1
        ORDER BY created_at ASC
      `,
      [requestId],
    );

  return result.rows.map(
    mapRequestEventRow,
  );
}