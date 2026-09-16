import { createIdentityApplication } from "./application/identityApplication.js";
import { jwtIdentityTokenCodec } from "./integration/jwtIdentityTokenCodec.js";
import { prismaIdentityRepository } from "./persistence/prismaIdentityRepository.js";

const application = createIdentityApplication(prismaIdentityRepository, jwtIdentityTokenCodec);

export type { AuthenticatedActor, TokenPurpose } from "./contracts.js";

export const issueAccessToken = application.issueAccessToken;
export const issuePurposeToken = application.issuePurposeToken;
export const resolveAccessToken = application.resolveAccessToken;
export const verifyPurposeToken = application.verifyPurposeToken;
export const validateIdentityConfiguration = application.validateConfiguration;
