import type { AuthenticatedActor } from "../modules/identity/index.js";

declare global {
  namespace Express {
    interface Request {
      actor?: AuthenticatedActor;
    }
  }
}

export {};
