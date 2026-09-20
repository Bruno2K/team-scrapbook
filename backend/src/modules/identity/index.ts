import { createIdentityApplication } from "./application/identityApplication.js";
import {
  ACCESS_TOKEN_TTL,
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_PATH,
  REFRESH_SESSION_TTL_MS,
  hashRefreshToken,
  readNamedCookie,
  refreshCookieOptions,
} from "./application/refreshToken.js";
import { jwtIdentityTokenCodec } from "./integration/jwtIdentityTokenCodec.js";
import { prismaIdentityRepository } from "./persistence/prismaIdentityRepository.js";

const application = createIdentityApplication(prismaIdentityRepository, jwtIdentityTokenCodec);

export type { AuthenticatedActor, TokenPurpose } from "./contracts.js";
export type { EstablishedRefreshSession } from "./application/identityApplication.js";
export {
  ACCESS_TOKEN_TTL,
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_PATH,
  REFRESH_SESSION_TTL_MS,
  hashRefreshToken,
  readNamedCookie,
  refreshCookieOptions,
};

export const issueAccessToken = application.issueAccessToken;
export const issuePurposeToken = application.issuePurposeToken;
export const resolveAccessToken = application.resolveAccessToken;
export const verifyPurposeToken = application.verifyPurposeToken;
export const createRefreshSession = application.createRefreshSession;
export const refreshAccessToken = application.refreshAccessToken;
export const revokeRefreshToken = application.revokeRefreshToken;
export const validateIdentityConfiguration = application.validateConfiguration;
