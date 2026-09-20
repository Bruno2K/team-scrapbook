import type { AuthenticatedActor, TokenPurpose } from "../contracts.js";
import {
  ACCESS_TOKEN_TTL,
  generateRefreshToken,
  hashRefreshToken,
  isRefreshSessionActive,
  refreshSessionExpiresAt,
} from "./refreshToken.js";

export interface IdentityRepository {
  findActorById(userId: string): Promise<AuthenticatedActor | null>;
  createRefreshSession(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  findRefreshSessionByTokenHash(tokenHash: string): Promise<{
    id: string;
    userId: string;
    expiresAt: Date;
    revokedAt: Date | null;
  } | null>;
  revokeRefreshSessionByTokenHash(tokenHash: string, revokedAt: Date): Promise<void>;
}

export interface IdentityTokenCodec {
  sign(userId: string, purpose: TokenPurpose, expiresIn: string | number): string;
  verify(token: string, expectedPurpose: TokenPurpose): { userId: string };
  validateConfiguration(): void;
}

export interface EstablishedRefreshSession {
  rawToken: string;
  expiresAt: Date;
}

export interface IdentityApplication {
  issueAccessToken(userId: string): string;
  issuePurposeToken(userId: string, purpose: Exclude<TokenPurpose, "access">, expiresIn: string | number): string;
  resolveAccessToken(token: string): Promise<AuthenticatedActor | null>;
  verifyPurposeToken(token: string, purpose: Exclude<TokenPurpose, "access">): Promise<AuthenticatedActor | null>;
  createRefreshSession(userId: string, now?: Date): Promise<EstablishedRefreshSession>;
  refreshAccessToken(rawRefreshToken: string, now?: Date): Promise<{ accessToken: string } | null>;
  revokeRefreshToken(rawRefreshToken: string, now?: Date): Promise<void>;
  validateConfiguration(): void;
}

function interactiveActor(actor: AuthenticatedActor | null): AuthenticatedActor | null {
  if (!actor || actor.isAiManaged) return null;
  return actor;
}

export function createIdentityApplication(
  repository: IdentityRepository,
  tokenCodec: IdentityTokenCodec,
): IdentityApplication {
  return {
    issueAccessToken(userId) {
      return tokenCodec.sign(userId, "access", ACCESS_TOKEN_TTL);
    },

    issuePurposeToken(userId, purpose, expiresIn) {
      return tokenCodec.sign(userId, purpose, expiresIn);
    },

    async resolveAccessToken(token) {
      const { userId } = tokenCodec.verify(token, "access");
      return repository.findActorById(userId);
    },

    async verifyPurposeToken(token, purpose) {
      const { userId } = tokenCodec.verify(token, purpose);
      return repository.findActorById(userId);
    },

    async createRefreshSession(userId, now = new Date()) {
      const rawToken = generateRefreshToken();
      const expiresAt = refreshSessionExpiresAt(now);
      await repository.createRefreshSession({
        userId,
        tokenHash: hashRefreshToken(rawToken),
        expiresAt,
      });
      return { rawToken, expiresAt };
    },

    async refreshAccessToken(rawRefreshToken, now = new Date()) {
      const session = await repository.findRefreshSessionByTokenHash(hashRefreshToken(rawRefreshToken));
      if (!session || !isRefreshSessionActive(session, now)) return null;
      const actor = interactiveActor(await repository.findActorById(session.userId));
      if (!actor) return null;
      return { accessToken: tokenCodec.sign(actor.id, "access", ACCESS_TOKEN_TTL) };
    },

    async revokeRefreshToken(rawRefreshToken, now = new Date()) {
      await repository.revokeRefreshSessionByTokenHash(hashRefreshToken(rawRefreshToken), now);
    },

    validateConfiguration() {
      tokenCodec.validateConfiguration();
    },
  };
}
