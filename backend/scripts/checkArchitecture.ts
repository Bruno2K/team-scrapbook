import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export interface ArchitectureViolation {
  file: string;
  specifier: string;
  rule: string;
}

const STATIC_IMPORT = /(?:import|export)\s+(?:type\s+)?(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g;

function normalize(file: string): string {
  return file.replaceAll("\\", "/").replace(/^\.\//, "");
}

function resolveSourceImport(sourceFile: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) return null;
  const resolved = normalize(path.posix.normalize(path.posix.join(path.posix.dirname(sourceFile), specifier)));
  return resolved.replace(/\.js$/, ".ts");
}

function modulePath(file: string): { module: string; rest: string } | null {
  const match = normalize(file).match(/^src\/modules\/([^/]+)\/(.+)$/);
  return match ? { module: match[1]!, rest: match[2]! } : null;
}

export function findArchitectureViolations(
  sources: Record<string, string>
): ArchitectureViolation[] {
  const violations: ArchitectureViolation[] = [];

  for (const [rawFile, source] of Object.entries(sources)) {
    const file = normalize(rawFile);
    const importerModule = modulePath(file);
    STATIC_IMPORT.lastIndex = 0;
    for (let match = STATIC_IMPORT.exec(source); match; match = STATIC_IMPORT.exec(source)) {
      const specifier = match[1]!;
      const resolved = resolveSourceImport(file, specifier);
      const importedModule = resolved ? modulePath(resolved) : null;

      if (
        importedModule &&
        importedModule.rest !== "index.ts" &&
        importerModule?.module !== importedModule.module
      ) {
        violations.push({
          file,
          specifier,
          rule: `imports internal file of module '${importedModule.module}'; import its index.js entrypoint`,
        });
      }

      if (
        importerModule &&
        /^(application|domain)\//.test(importerModule.rest) &&
        (specifier === "express" || specifier === "socket.io")
      ) {
        violations.push({
          file,
          specifier,
          rule: "application/domain code must not depend on HTTP or Socket.io frameworks",
        });
      }

      if (
        importerModule &&
        !importerModule.rest.startsWith("persistence/") &&
        (specifier === "@prisma/client" || resolved === "src/db/client.ts")
      ) {
        violations.push({
          file,
          specifier,
          rule: "Prisma access inside a module belongs in its persistence adapter",
        });
      }
    }
  }

  return violations;
}

async function listTypeScriptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) return listTypeScriptFiles(target);
      return entry.isFile() && entry.name.endsWith(".ts") ? [target] : [];
    })
  );
  return nested.flat();
}

export async function checkArchitecture(rootDirectory = process.cwd()): Promise<ArchitectureViolation[]> {
  const sourceRoot = path.join(rootDirectory, "src");
  const files = await listTypeScriptFiles(sourceRoot);
  const sources: Record<string, string> = {};
  await Promise.all(
    files.map(async (file) => {
      sources[normalize(path.relative(rootDirectory, file))] = await readFile(file, "utf8");
    })
  );
  return findArchitectureViolations(sources);
}

async function main() {
  const violations = await checkArchitecture();
  if (violations.length === 0) {
    console.log("Architecture boundaries: pass");
    return;
  }
  for (const violation of violations) {
    console.error(`${violation.file}: ${violation.rule} (${violation.specifier})`);
  }
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
