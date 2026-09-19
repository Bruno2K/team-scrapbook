export interface ReleaseIdentity {
  gitSha: string | null;
  deploymentId: string | null;
}

export function getReleaseIdentity(): ReleaseIdentity {
  return {
    gitSha: process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? null,
    deploymentId: process.env.RAILWAY_DEPLOYMENT_ID ?? null,
  };
}

export function sanitizedRuntimeConfig() {
  return {
    nodeEnv: process.env.NODE_ENV ?? "undefined",
    port: process.env.PORT ?? "3000",
    corsOriginConfigured: Boolean(process.env.CORS_ORIGIN),
    jwtConfigured: Boolean(process.env.JWT_SECRET),
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    steamConfigured: Boolean(process.env.STEAM_WEB_API_KEY),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    r2Configured: Boolean(
      process.env.R2_ACCOUNT_ID
        && process.env.R2_ACCESS_KEY_ID
        && process.env.R2_SECRET_ACCESS_KEY
        && process.env.R2_BUCKET
        && process.env.R2_PUBLIC_BASE_URL,
    ),
  };
}
