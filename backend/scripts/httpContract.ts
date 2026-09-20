import type { Application } from "express";

export interface HttpOperation {
  method: string;
  path: string;
}

export interface ContractExclusion {
  id: string;
  rationale: string;
  matches: (operation: HttpOperation) => boolean;
}

export interface HttpContractDrift {
  missingInOpenApi: HttpOperation[];
  missingInRuntime: HttpOperation[];
  invalidExclusions: Array<{ id: string; rationale: string }>;
}

export const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "options"] as const;

/**
 * Swagger UI and the raw OpenAPI document are documentation surfaces, not product routes.
 * Prefix-scoped so product mounts such as /users or /feed cannot be hidden by accident.
 */
export const DOCUMENTATION_SURFACE_EXCLUSIONS: ContractExclusion[] = [
  {
    id: "swagger-ui",
    rationale:
      "Swagger UI is mounted at /api-docs for humans. Product clients use HTTP routes, not the UI or its static assets.",
    matches: (operation) => operation.path === "/api-docs" || operation.path.startsWith("/api-docs/"),
  },
  {
    id: "openapi-document",
    rationale:
      "GET /api-docs.json serves the checked-in OpenAPI document. It is a documentation endpoint, not a product resource.",
    matches: (operation) => operation.path === "/api-docs.json",
  },
];

type ExpressLayer = {
  name?: string;
  keys?: Array<{ name: string }>;
  regexp?: RegExp & { fast_slash?: boolean };
  route?: {
    path: string | string[];
    methods: Record<string, boolean | undefined>;
  };
  handle?: { stack?: ExpressLayer[] };
};

function isHttpMethod(value: string): value is (typeof HTTP_METHODS)[number] {
  return (HTTP_METHODS as readonly string[]).includes(value);
}

export function normalizeHttpPath(path: string): string {
  const withSlash = path.startsWith("/") ? path : `/${path}`;
  const collapsed = withSlash.replace(/\/{2,}/g, "/");
  const parameterized = collapsed.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
  if (parameterized.length > 1 && parameterized.endsWith("/")) {
    return parameterized.slice(0, -1);
  }
  return parameterized || "/";
}

export function joinHttpPaths(prefix: string, routePath: string): string {
  if (!routePath || routePath === "/") return normalizeHttpPath(prefix || "/");
  if (!prefix || prefix === "/") return normalizeHttpPath(routePath);
  return normalizeHttpPath(`${prefix.replace(/\/$/, "")}/${routePath.replace(/^\//, "")}`);
}

export function operationKey(operation: HttpOperation): string {
  return `${operation.method.toUpperCase()} ${normalizeHttpPath(operation.path)}`;
}

export function sortOperations(operations: HttpOperation[]): HttpOperation[] {
  return [...operations].sort((a, b) => operationKey(a).localeCompare(operationKey(b)));
}

export function uniqueOperations(operations: HttpOperation[]): HttpOperation[] {
  const seen = new Set<string>();
  const unique: HttpOperation[] = [];
  for (const operation of operations) {
    const normalized = {
      method: operation.method.toLowerCase(),
      path: normalizeHttpPath(operation.path),
    };
    const key = operationKey(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(normalized);
  }
  return sortOperations(unique);
}

/**
 * Reconstruct an Express 4 mount prefix from the layer regexp.
 * `app.use("/health", router)` compiles to /^\/health\/?(?=\/|$)/i.
 */
export function mountPathFromLayer(layer: {
  regexp?: RegExp & { fast_slash?: boolean };
  keys?: Array<{ name: string }>;
}): string {
  const regexp = layer.regexp;
  if (!regexp || regexp.fast_slash) return "";

  let source = regexp.source;
  if (source === "^\\/?(?=\\/|$)" || source === "^\\/?$") return "";

  source = source.replace(/^\^/, "").replace(/\$$/, "");
  source = source.replace(/\\\/\?\(\?=\\\/\|\$\)$/, "");
  source = source.replace(/\(\?=\\\/\|\$\)$/, "");

  const keys = layer.keys ?? [];
  let keyIndex = 0;
  source = source.replace(/\(\?:([^)]+)\)\?/g, "");
  source = source.replace(/\(\[\^\\\/]\+\?\)/g, () => {
    const name = keys[keyIndex++]?.name ?? "param";
    return `:${name}`;
  });
  source = source.replace(/\\(.)/g, "$1");

  if (!source.startsWith("/")) source = `/${source}`;
  if (source === "/") return "";
  return source.replace(/\/$/, "");
}

function walkStack(stack: ExpressLayer[] | undefined, prefix: string, operations: HttpOperation[]): void {
  if (!stack) return;

  for (const layer of stack) {
    if (layer.route) {
      const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
      const methods = Object.keys(layer.route.methods)
        .map((method) => method.toLowerCase())
        .filter(isHttpMethod);
      for (const routePath of paths) {
        const path = joinHttpPaths(prefix, routePath);
        for (const method of methods) {
          operations.push({ method, path });
        }
      }
      continue;
    }

    if (layer.handle?.stack) {
      const mounted = joinHttpPaths(prefix, mountPathFromLayer(layer) || "/");
      const nextPrefix = mounted === "/" ? prefix : mounted;
      walkStack(layer.handle.stack, nextPrefix === "/" && prefix ? prefix : nextPrefix, operations);
    }
  }
}

function appRouterStack(app: Application): ExpressLayer[] {
  const router = (app as Application & { _router?: { stack?: ExpressLayer[] } })._router;
  if (!router?.stack) {
    throw new Error("Express application has no router stack; the composed app was not initialized");
  }
  return router.stack;
}

export function extractRuntimeHttpOperations(app: Application): HttpOperation[] {
  const operations: HttpOperation[] = [];
  walkStack(appRouterStack(app), "", operations);
  return uniqueOperations(operations);
}

/**
 * Non-root middleware mounts that are not Express route/router layers.
 * Swagger UI installs serve/setup middleware at /api-docs without METHOD+PATH route objects.
 */
export function extractNonRouteMounts(app: Application): string[] {
  const mounts = new Set<string>();
  for (const layer of appRouterStack(app)) {
    if (layer.route || layer.handle?.stack) continue;
    const mount = mountPathFromLayer(layer);
    if (!mount || mount === "/") continue;
    mounts.add(normalizeHttpPath(mount));
  }
  return [...mounts].sort();
}

export function extractOpenApiHttpOperations(spec: {
  paths?: Record<string, Record<string, unknown> | undefined>;
}): HttpOperation[] {
  const operations: HttpOperation[] = [];
  for (const [path, item] of Object.entries(spec.paths ?? {})) {
    if (!item) continue;
    for (const method of Object.keys(item)) {
      if (!isHttpMethod(method)) continue;
      if (item[method] && typeof item[method] === "object") {
        operations.push({ method, path });
      }
    }
  }
  return uniqueOperations(operations);
}

export function applyExclusions(
  operations: HttpOperation[],
  exclusions: ContractExclusion[]
): HttpOperation[] {
  return operations.filter((operation) => !exclusions.some((exclusion) => exclusion.matches(operation)));
}

export function findHttpContractDrift(input: {
  runtime: HttpOperation[];
  openApi: HttpOperation[];
  exclusions?: ContractExclusion[];
  nonRouteMounts?: string[];
}): HttpContractDrift {
  const exclusions = input.exclusions ?? DOCUMENTATION_SURFACE_EXCLUSIONS;
  const runtime = uniqueOperations(input.runtime);
  const openApi = uniqueOperations(input.openApi);
  const mountOperations = uniqueOperations(
    (input.nonRouteMounts ?? []).map((path) => ({ method: "get", path }))
  );
  const exclusionPool = [...runtime, ...openApi, ...mountOperations];

  const invalidExclusions = exclusions
    .filter((exclusion) => !exclusionPool.some(exclusion.matches))
    .map(({ id, rationale }) => ({ id, rationale }));

  const productRuntime = applyExclusions(runtime, exclusions);
  const productOpenApi = applyExclusions(openApi, exclusions);

  const runtimeKeys = new Set(productRuntime.map(operationKey));
  const openApiKeys = new Set(productOpenApi.map(operationKey));

  return {
    missingInOpenApi: productRuntime.filter((operation) => !openApiKeys.has(operationKey(operation))),
    missingInRuntime: productOpenApi.filter((operation) => !runtimeKeys.has(operationKey(operation))),
    invalidExclusions,
  };
}

export function formatHttpContractDrift(drift: HttpContractDrift): string {
  const lines: string[] = [];
  if (drift.missingInOpenApi.length > 0) {
    lines.push("missing in OpenAPI:");
    for (const operation of drift.missingInOpenApi) {
      lines.push(`  ${operationKey(operation)}`);
    }
  }
  if (drift.missingInRuntime.length > 0) {
    lines.push("missing in runtime:");
    for (const operation of drift.missingInRuntime) {
      lines.push(`  ${operationKey(operation)}`);
    }
  }
  if (drift.invalidExclusions.length > 0) {
    lines.push("invalid exclusion:");
    for (const exclusion of drift.invalidExclusions) {
      lines.push(`  ${exclusion.id} — ${exclusion.rationale}`);
    }
  }
  return lines.join("\n");
}

export function hasHttpContractDrift(drift: HttpContractDrift): boolean {
  return (
    drift.missingInOpenApi.length > 0 ||
    drift.missingInRuntime.length > 0 ||
    drift.invalidExclusions.length > 0
  );
}
