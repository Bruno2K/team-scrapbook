import jwt, { type JwtPayload } from "jsonwebtoken";
import type { IdentityTokenCodec } from "../application/identityApplication.js";
import type { TokenPurpose } from "../contracts.js";

const DEVELOPMENT_SECRET = "dev-secret-change-in-production";
const MIN_PRODUCTION_SECRET_LENGTH = 32;

function configuredSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is required in production");
  }
  return DEVELOPMENT_SECRET;
}

function validateProductionSecret(secret: string): void {
  if (process.env.NODE_ENV !== "production") return;
  if (secret === DEVELOPMENT_SECRET || secret.length < MIN_PRODUCTION_SECRET_LENGTH) {
    throw new Error("JWT_SECRET must be a non-default value of at least 32 characters in production");
  }
}

function readUserId(payload: string | JwtPayload): string {
  if (typeof payload === "string") throw new Error("Invalid token claims");
  const legacyUserId = typeof payload.userId === "string" ? payload.userId : null;
  const subject = typeof payload.sub === "string" ? payload.sub : null;
  if (!legacyUserId && !subject) throw new Error("Invalid token claims");
  if (legacyUserId && subject && legacyUserId !== subject) throw new Error("Invalid token claims");
  const userId = legacyUserId ?? subject;
  if (!userId?.trim()) throw new Error("Invalid token claims");
  return userId;
}

export const jwtIdentityTokenCodec: IdentityTokenCodec = {
  sign(userId, purpose, expiresIn) {
    const secret = configuredSecret();
    validateProductionSecret(secret);
    return jwt.sign(
      { userId, purpose },
      secret,
      { algorithm: "HS256", subject: userId, expiresIn: expiresIn as jwt.SignOptions["expiresIn"] },
    );
  },

  verify(token, expectedPurpose) {
    const secret = configuredSecret();
    validateProductionSecret(secret);
    const payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
    const purpose = typeof payload === "string" ? undefined : payload.purpose;
    // Access tokens issued before this hardening did not include a purpose claim.
    if (expectedPurpose === "access") {
      if (purpose !== undefined && purpose !== "access") throw new Error("Invalid token purpose");
    } else if (purpose !== expectedPurpose) {
      throw new Error("Invalid token purpose");
    }
    return { userId: readUserId(payload) };
  },

  validateConfiguration() {
    const secret = configuredSecret();
    validateProductionSecret(secret);
  },
};
