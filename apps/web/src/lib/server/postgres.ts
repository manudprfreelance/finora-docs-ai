import { Pool } from "pg";

declare global {
  var finoraPostgresPool: Pool | undefined;
}

function createPool(): Pool {
  const host =
    process.env.POSTGRES_HOST;

  const port =
    process.env.POSTGRES_PORT;

  const database =
    process.env.POSTGRES_DB;

  const user =
    process.env.POSTGRES_USER;

  const password =
    process.env.POSTGRES_PASSWORD;

  if (
    !host ||
    !port ||
    !database ||
    !user ||
    !password
  ) {
    throw new Error(
      "PostgreSQL environment variables are not configured.",
    );
  }

  return new Pool({
    host,
    port: Number(port),
    database,
    user,
    password,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

export const postgresPool =
  global.finoraPostgresPool ??
  createPool();

if (process.env.NODE_ENV !== "production") {
  global.finoraPostgresPool =
    postgresPool;
}