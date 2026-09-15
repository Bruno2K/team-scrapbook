export function assertTestDatabaseUrl(rawUrl = process.env.DATABASE_URL): URL {
  if (!rawUrl) {
    throw new Error("DATABASE_URL is required for PostgreSQL integration tests");
  }

  let databaseUrl: URL;
  try {
    databaseUrl = new URL(rawUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL");
  }

  if (!["postgresql:", "postgres:"].includes(databaseUrl.protocol)) {
    throw new Error("Integration tests require PostgreSQL; SQLite and other providers are not supported");
  }

  const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ""));
  if (!/(^|[_-])test($|[_-])/i.test(databaseName)) {
    throw new Error(
      `Refusing to run integration tests against database "${databaseName}"; its name must contain a test segment`,
    );
  }

  return databaseUrl;
}
