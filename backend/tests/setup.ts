import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.DATABASE_URL = process.env.DATABASE_URL ?? `file:${path.join(__dirname, "..", "test.db")}`;
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-jwt-secret";

execSync("npx prisma migrate deploy", {
  cwd: path.join(__dirname, ".."),
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
});
