export function healthToJSON() {
  return {
    status: "ok",
    service: "team-scrapbook-api",
    timestamp: new Date().toISOString(),
  };
}
