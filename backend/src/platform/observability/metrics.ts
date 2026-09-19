const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
const STATUS_CLASSES = new Set(["1xx", "2xx", "3xx", "4xx", "5xx"]);
const DEPENDENCIES = new Set(["postgresql", "steam", "gemini", "r2"]);
const OUTCOMES = new Set(["success", "failure"]);
const FAILURE_CATEGORIES = new Set([
  "none",
  "timeout",
  "network",
  "http_4xx",
  "http_5xx",
  "rate_limited",
  "not_configured",
  "conflict",
  "unknown",
]);
const SOCKET_REASON_CLASSES = new Set([
  "client_disconnect",
  "transport",
  "timeout",
  "server_disconnect",
  "parse_error",
  "other",
]);
const SOCKET_EVENTS = new Set(["message", "typing", "connection"]);
const SOCKET_CODES = new Set(["RATE_LIMITED", "INVALID_MESSAGE", "FORBIDDEN", "UNAUTHENTICATED"]);
const LATENCY_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

export const PROBE_ROUTES = new Set(["/health", "/health/ready", "/metrics"]);

export const HTTP_LATENCY_BUCKETS = LATENCY_BUCKETS;

type Labels = Record<string, string>;

function allow(value: string, allowed: Set<string>, fallback = "other"): string {
  return allowed.has(value) ? value : fallback;
}

export function normalizeHttpMethod(method: string | undefined): string {
  const upper = (method ?? "OTHER").toUpperCase();
  return HTTP_METHODS.has(upper) ? upper : "OTHER";
}

export function statusClass(status: number): string {
  if (status >= 100 && status < 600) {
    return `${Math.floor(status / 100)}xx`;
  }
  return "other";
}

export function normalizeRoute(route: string | undefined): string {
  if (!route || route === "*") return "unmatched";
  const collapsed = route.replace(/\/{2,}/g, "/");
  if (collapsed.length > 120) return "unmatched";
  return collapsed;
}

function labelKey(labels: Labels): string {
  return Object.keys(labels)
    .sort()
    .map((key) => `${key}=${labels[key]}`)
    .join(",");
}

class Counter {
  private readonly values = new Map<string, number>();

  constructor(readonly name: string, readonly help: string, readonly labelNames: string[]) {}

  inc(labels: Labels, amount = 1): void {
    const key = labelKey(labels);
    this.values.set(key, (this.values.get(key) ?? 0) + amount);
  }

  get(labels: Labels): number {
    return this.values.get(labelKey(labels)) ?? 0;
  }

  snapshot(): Array<{ labels: Labels; value: number }> {
    return [...this.values.entries()].map(([key, value]) => ({
      labels: Object.fromEntries(key.split(",").filter(Boolean).map((part) => part.split("=") as [string, string])),
      value,
    }));
  }

  reset(): void {
    this.values.clear();
  }
}

class Gauge {
  private value = 0;

  constructor(readonly name: string, readonly help: string) {}

  set(value: number): void {
    this.value = value;
  }

  inc(amount = 1): void {
    this.value += amount;
  }

  dec(amount = 1): void {
    this.value -= amount;
  }

  get(): number {
    return this.value;
  }

  reset(): void {
    this.value = 0;
  }
}

class Histogram {
  private readonly counts = new Map<string, number[]>();
  private readonly sums = new Map<string, number>();
  private readonly totals = new Map<string, number>();

  constructor(
    readonly name: string,
    readonly help: string,
    readonly buckets: number[],
  ) {}

  observe(labels: Labels, value: number): void {
    const key = labelKey(labels);
    const buckets = this.counts.get(key) ?? this.buckets.map(() => 0);
    for (let i = 0; i < this.buckets.length; i += 1) {
      if (value <= this.buckets[i]!) buckets[i]! += 1;
    }
    this.counts.set(key, buckets);
    this.sums.set(key, (this.sums.get(key) ?? 0) + value);
    this.totals.set(key, (this.totals.get(key) ?? 0) + 1);
  }

  getCount(labels: Labels): number {
    return this.totals.get(labelKey(labels)) ?? 0;
  }

  getSum(labels: Labels): number {
    return this.sums.get(labelKey(labels)) ?? 0;
  }

  snapshot(): Array<{ labels: Labels; buckets: number[]; sum: number; count: number }> {
    return [...this.counts.entries()].map(([key, buckets]) => ({
      labels: Object.fromEntries(key.split(",").filter(Boolean).map((part) => part.split("=") as [string, string])),
      buckets,
      sum: this.sums.get(key) ?? 0,
      count: this.totals.get(key) ?? 0,
    }));
  }

  reset(): void {
    this.counts.clear();
    this.sums.clear();
    this.totals.clear();
  }
}

function escapeLabel(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll('"', '\\"');
}

function formatLabels(labels: Labels): string {
  const keys = Object.keys(labels);
  if (keys.length === 0) return "";
  return `{${keys.map((key) => `${key}="${escapeLabel(labels[key]!)}"`).join(",")}}`;
}

const httpRequestsTotal = new Counter(
  "http_requests_total",
  "HTTP requests handled by this process",
  ["method", "route", "status_class"],
);
const httpRequestErrorsTotal = new Counter(
  "http_request_errors_total",
  "HTTP responses classified as server errors by this process",
  ["method", "route", "status_class"],
);
const httpRequestDurationMs = new Histogram(
  "http_request_duration_ms",
  "HTTP request duration in milliseconds for this process",
  LATENCY_BUCKETS,
);
const httpRequestsInFlight = new Gauge(
  "http_requests_in_flight",
  "HTTP requests currently being handled by this process",
);
const readinessState = new Gauge(
  "readiness_state",
  "PostgreSQL readiness of this process: 1 ready, 0 unavailable",
);
const dbTransactionConflictsTotal = new Counter(
  "db_transaction_conflicts_total",
  "Serializable transaction conflicts exhausted after retries in this process",
  [],
);
const dbTransactionRetriesTotal = new Counter(
  "db_transaction_retries_total",
  "Serializable transaction retries in this process",
  [],
);
const dependencyRequestsTotal = new Counter(
  "dependency_requests_total",
  "Outbound dependency call outcomes for this process",
  ["dependency", "outcome", "failure_category"],
);
const dependencyRequestDurationMs = new Histogram(
  "dependency_request_duration_ms",
  "Outbound dependency call duration in milliseconds for this process",
  LATENCY_BUCKETS,
);
const socketConnectionsAcceptedTotal = new Counter(
  "socket_connections_accepted_total",
  "Authenticated Socket.io connections accepted by this process",
  [],
);
const socketConnectionsRejectedTotal = new Counter(
  "socket_connections_rejected_total",
  "Socket.io connections rejected by this process",
  [],
);
const socketDisconnectsTotal = new Counter(
  "socket_disconnects_total",
  "Socket.io disconnects observed by this process",
  ["reason_class"],
);
const socketPolicyFailuresTotal = new Counter(
  "socket_policy_failures_total",
  "Socket.io policy or validation failures on touched paths in this process",
  ["event", "code"],
);
const socketConnectionsActive = new Gauge(
  "socket_connections_active",
  "Currently connected Socket.io clients on this process only",
);

let socketCountProvider: () => number = () => socketConnectionsActive.get();

export function setSocketCountProvider(provider: () => number): void {
  socketCountProvider = provider;
}

export function recordHttpRequest(input: {
  method: string;
  route: string;
  status: number;
  durationMs: number;
}): void {
  const labels = {
    method: normalizeHttpMethod(input.method),
    route: normalizeRoute(input.route),
    status_class: allow(statusClass(input.status), STATUS_CLASSES),
  };
  httpRequestsTotal.inc(labels);
  httpRequestDurationMs.observe({ method: labels.method, route: labels.route }, input.durationMs);
  if (input.status >= 500 && !PROBE_ROUTES.has(labels.route)) {
    httpRequestErrorsTotal.inc(labels);
  }
}

export function incInFlight(): void {
  httpRequestsInFlight.inc();
}

export function decInFlight(): void {
  httpRequestsInFlight.dec();
}

export function setReadinessMetric(ready: boolean): void {
  readinessState.set(ready ? 1 : 0);
}

export function recordTransactionRetry(): void {
  dbTransactionRetriesTotal.inc({});
}

export function recordTransactionConflict(): void {
  dbTransactionConflictsTotal.inc({});
}

export function recordDependency(input: {
  dependency: string;
  outcome: "success" | "failure";
  failureCategory: string;
  durationMs: number;
}): void {
  const labels = {
    dependency: allow(input.dependency, DEPENDENCIES),
    outcome: allow(input.outcome, OUTCOMES),
    failure_category: allow(input.failureCategory, FAILURE_CATEGORIES, "unknown"),
  };
  dependencyRequestsTotal.inc(labels);
  dependencyRequestDurationMs.observe({ dependency: labels.dependency }, input.durationMs);
}

export function recordSocketAccepted(): void {
  socketConnectionsAcceptedTotal.inc({});
}

export function recordSocketRejected(): void {
  socketConnectionsRejectedTotal.inc({});
}

export function recordSocketDisconnect(reasonClass: string): void {
  socketDisconnectsTotal.inc({ reason_class: allow(reasonClass, SOCKET_REASON_CLASSES) });
}

export function recordSocketPolicyFailure(event: string, code: string): void {
  socketPolicyFailuresTotal.inc({
    event: allow(event, SOCKET_EVENTS),
    code: allow(code, SOCKET_CODES),
  });
}

export function getCounterValue(name: string, labels: Labels = {}): number {
  const counters: Record<string, Counter> = {
    http_requests_total: httpRequestsTotal,
    http_request_errors_total: httpRequestErrorsTotal,
    db_transaction_conflicts_total: dbTransactionConflictsTotal,
    db_transaction_retries_total: dbTransactionRetriesTotal,
    dependency_requests_total: dependencyRequestsTotal,
    socket_connections_accepted_total: socketConnectionsAcceptedTotal,
    socket_connections_rejected_total: socketConnectionsRejectedTotal,
    socket_disconnects_total: socketDisconnectsTotal,
    socket_policy_failures_total: socketPolicyFailuresTotal,
  };
  return counters[name]?.get(labels) ?? 0;
}

export function getGaugeValue(name: string): number {
  if (name === "socket_connections_active") return socketCountProvider();
  const gauges: Record<string, Gauge> = {
    http_requests_in_flight: httpRequestsInFlight,
    readiness_state: readinessState,
    socket_connections_active: socketConnectionsActive,
  };
  return gauges[name]?.get() ?? 0;
}

export function getHistogramCount(name: string, labels: Labels = {}): number {
  if (name === "http_request_duration_ms") return httpRequestDurationMs.getCount(labels);
  if (name === "dependency_request_duration_ms") return dependencyRequestDurationMs.getCount(labels);
  return 0;
}

function renderCounter(counter: Counter): string[] {
  const lines = [`# HELP ${counter.name} ${counter.help}`, `# TYPE ${counter.name} counter`];
  const snapshot = counter.snapshot();
  if (snapshot.length === 0) {
    lines.push(`${counter.name} 0`);
    return lines;
  }
  for (const row of snapshot) {
    lines.push(`${counter.name}${formatLabels(row.labels)} ${row.value}`);
  }
  return lines;
}

function renderGauge(gauge: Gauge, value = gauge.get()): string[] {
  return [
    `# HELP ${gauge.name} ${gauge.help}`,
    `# TYPE ${gauge.name} gauge`,
    `${gauge.name} ${value}`,
  ];
}

function renderHistogram(histogram: Histogram): string[] {
  const lines = [`# HELP ${histogram.name} ${histogram.help}`, `# TYPE ${histogram.name} histogram`];
  const snapshot = histogram.snapshot();
  if (snapshot.length === 0) {
    for (const bucket of histogram.buckets) {
      lines.push(`${histogram.name}_bucket{le="${bucket}"} 0`);
    }
    lines.push(`${histogram.name}_bucket{le="+Inf"} 0`);
    lines.push(`${histogram.name}_sum 0`);
    lines.push(`${histogram.name}_count 0`);
    return lines;
  }
  for (const row of snapshot) {
    histogram.buckets.forEach((bucket, index) => {
      lines.push(`${histogram.name}_bucket${formatLabels({ ...row.labels, le: String(bucket) })} ${row.buckets[index] ?? 0}`);
    });
    lines.push(`${histogram.name}_bucket${formatLabels({ ...row.labels, le: "+Inf" })} ${row.count}`);
    const withoutLe = { ...row.labels };
    lines.push(`${histogram.name}_sum${formatLabels(withoutLe)} ${row.sum}`);
    lines.push(`${histogram.name}_count${formatLabels(withoutLe)} ${row.count}`);
  }
  return lines;
}

export function renderPrometheus(): string {
  return [
    ...renderCounter(httpRequestsTotal),
    ...renderCounter(httpRequestErrorsTotal),
    ...renderHistogram(httpRequestDurationMs),
    ...renderGauge(httpRequestsInFlight),
    ...renderGauge(readinessState),
    ...renderCounter(dbTransactionConflictsTotal),
    ...renderCounter(dbTransactionRetriesTotal),
    ...renderCounter(dependencyRequestsTotal),
    ...renderHistogram(dependencyRequestDurationMs),
    ...renderCounter(socketConnectionsAcceptedTotal),
    ...renderCounter(socketConnectionsRejectedTotal),
    ...renderCounter(socketDisconnectsTotal),
    ...renderCounter(socketPolicyFailuresTotal),
    ...renderGauge(socketConnectionsActive, socketCountProvider()),
  ].join("\n") + "\n";
}

export function resetMetrics(): void {
  httpRequestsTotal.reset();
  httpRequestErrorsTotal.reset();
  httpRequestDurationMs.reset();
  httpRequestsInFlight.reset();
  readinessState.reset();
  dbTransactionConflictsTotal.reset();
  dbTransactionRetriesTotal.reset();
  dependencyRequestsTotal.reset();
  dependencyRequestDurationMs.reset();
  socketConnectionsAcceptedTotal.reset();
  socketConnectionsRejectedTotal.reset();
  socketDisconnectsTotal.reset();
  socketPolicyFailuresTotal.reset();
  socketConnectionsActive.reset();
}

export const METRIC_LABEL_CONTRACT = {
  http_requests_total: ["method", "route", "status_class"],
  http_request_errors_total: ["method", "route", "status_class"],
  http_request_duration_ms: ["method", "route"],
  dependency_requests_total: ["dependency", "outcome", "failure_category"],
  dependency_request_duration_ms: ["dependency"],
  socket_disconnects_total: ["reason_class"],
  socket_policy_failures_total: ["event", "code"],
  forbidden_label_names: [
    "userId",
    "requestId",
    "messageId",
    "conversationId",
    "communityId",
    "url",
    "nickname",
    "errorMessage",
  ],
} as const;
