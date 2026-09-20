export function getConfiguredFrontendOrigins(raw = process.env.CORS_ORIGIN): string[] {
  const configured = (raw ?? "http://localhost:8080").split(",").map((origin) => origin.trim()).filter(Boolean);
  const origins = configured.filter((origin) => origin !== "*");
  if (origins.length === 0) return [];
  return [...new Set(origins)];
}

export function isAllowedFrontendOrigin(
  origin: string | undefined,
  raw = process.env.CORS_ORIGIN,
): boolean {
  if (!origin) return false;
  return getConfiguredFrontendOrigins(raw).includes(origin);
}
