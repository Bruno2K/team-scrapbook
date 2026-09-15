import { assertTestDatabaseUrl } from "../testDatabase.js";

assertTestDatabaseUrl();
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "integration-test-jwt-secret";
