import type { AuthenticatedActor, TokenPurpose } from "../contracts.js";

export interface IdentityRepository {
  findActorById(userId: string): Promise<AuthenticatedActor | null>;
}

export interface IdentityTokenCodec {
  sign(userId: string, purpose: TokenPurpose, expiresIn: string | number): string;
  verify(token: string, expectedPurpose: TokenPurpose): { userId: string };
  validateConfiguration(): void;
}

export interface IdentityApplication {
  issueAccessToken(userId: string): string;
  issuePurposeToken(userId: string, purpose: Exclude<TokenPurpose, "access">, expiresIn: string | number): string;
  resolveAccessToken(token: string): Promise<AuthenticatedActor | null>;
  verifyPurposeToken(token: string, purpose: Exclude<TokenPurpose, "access">): Promise<AuthenticatedActor | null>;
  validateConfiguration(): void;
}

export function createIdentityApplication(
  repository: IdentityRepository,
  tokenCodec: IdentityTokenCodec,
): IdentityApplication {
  return {
    issueAccessToken(userId) {
      return tokenCodec.sign(userId, "access", "7d");
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

    validateConfiguration() {
      tokenCodec.validateConfiguration();
    },
  };
}
