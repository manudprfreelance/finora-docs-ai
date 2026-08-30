import { randomUUID } from "crypto";

import { DocumentRequest } from "@/lib/request-types";

import {
  RequestRepository,
  StoredRequest,
} from "@/lib/server/request-repository";

import {
  postgresPool,
} from "@/lib/server/postgres";

interface RequestSessionRow {
  id: string;
  request_state: DocumentRequest;
  status: string;
  created_at: Date;
  updated_at: Date;
}

function mapRowToStoredRequest(
  row: RequestSessionRow,
): StoredRequest {
  return {
    requestId: row.id,
    requestState: row.request_state,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export class PostgresRequestRepository
  implements RequestRepository
{
  async create(
    requestState: DocumentRequest,
  ): Promise<StoredRequest> {
    const requestId = randomUUID();

    const result =
      await postgresPool.query<RequestSessionRow>(
        `
          INSERT INTO request_sessions (
            id,
            request_state,
            status
          )
          VALUES ($1, $2::jsonb, $3)
          RETURNING
            id,
            request_state,
            status,
            created_at,
            updated_at
        `,
        [
          requestId,
          JSON.stringify(requestState),
          requestState.status,
        ],
      );

    return mapRowToStoredRequest(
      result.rows[0],
    );
  }

  async findById(
    requestId: string,
  ): Promise<StoredRequest | null> {
    const result =
      await postgresPool.query<RequestSessionRow>(
        `
          SELECT
            id,
            request_state,
            status,
            created_at,
            updated_at
          FROM request_sessions
          WHERE id = $1
          LIMIT 1
        `,
        [requestId],
      );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return mapRowToStoredRequest(row);
  }

  async save(
    requestId: string,
    requestState: DocumentRequest,
  ): Promise<StoredRequest> {
    const result =
      await postgresPool.query<RequestSessionRow>(
        `
          UPDATE request_sessions
          SET
            request_state = $2::jsonb,
            status = $3,
            updated_at = NOW()
          WHERE id = $1
          RETURNING
            id,
            request_state,
            status,
            created_at,
            updated_at
        `,
        [
          requestId,
          JSON.stringify(requestState),
          requestState.status,
        ],
      );

    const row = result.rows[0];

    if (!row) {
      throw new Error(
        `Request session ${requestId} was not found.`,
      );
    }

    return mapRowToStoredRequest(row);
  }

  async delete(
    requestId: string,
  ): Promise<boolean> {
    const result =
      await postgresPool.query(
        `
          DELETE FROM request_sessions
          WHERE id = $1
        `,
        [requestId],
      );

    return (result.rowCount ?? 0) > 0;
  }
}

export const requestRepository =
  new PostgresRequestRepository();