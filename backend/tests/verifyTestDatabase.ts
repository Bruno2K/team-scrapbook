import { assertTestDatabaseUrl } from "./testDatabase.js";

const databaseUrl = assertTestDatabaseUrl();
console.log(`Verified isolated PostgreSQL test database: ${databaseUrl.hostname}/${databaseUrl.pathname.slice(1)}`);
