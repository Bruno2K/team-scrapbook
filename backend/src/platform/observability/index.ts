export { correlationMiddleware, normalizeRequestId, REQUEST_ID_HEADER } from "./correlation.js";
export { observeDependency, classifyHttpFailure, classifyUnknownFailure } from "./dependencies.js";
export type { DependencyName, FailureCategory } from "./dependencies.js";
export {
  httpObservabilityMiddleware,
  metricsHandler,
  requestRoute,
  unhandledErrorMiddleware,
} from "./http.js";
export {
  installProcessSignalHandlers,
  isShuttingDown,
  listenHttpServer,
  logReady,
  logStartup,
  resetLifecycleState,
  shutdownProcess,
  SHUTDOWN_TIMEOUT_MS,
} from "./lifecycle.js";
export type { ManagedProcess } from "./lifecycle.js";
export { log, resetLogWriter, setLogWriter } from "./logger.js";
export {
  getCounterValue,
  getGaugeValue,
  getHistogramCount,
  METRIC_LABEL_CONTRACT,
  PROBE_ROUTES,
  recordHttpRequest,
  recordTransactionConflict,
  recordTransactionRetry,
  recordOutboxAttempt,
  recordOutboxCompleted,
  recordOutboxLeaseRecovered,
  recordOutboxProcessingDuration,
  recordOutboxRetryableFailure,
  recordOutboxTerminalFailure,
  renderPrometheus,
  resetMetrics,
  setOutboxBacklog,
  setOutboxWorkerUp,
  setReadinessMetric,
  setSocketCountProvider,
} from "./metrics.js";
export { observeSocketAccepted, observeSocketDisconnect, observeSocketPolicyFailure, observeSocketRejected } from "./realtime.js";
export { isDatabaseReady, resetReadinessCache } from "./readiness.js";
export { getReleaseIdentity, sanitizedRuntimeConfig } from "./release.js";
