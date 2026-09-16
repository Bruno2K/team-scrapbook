export interface AuthenticatedActor {
  id: string;
  isAiManaged: boolean;
}

export type TokenPurpose = "access" | "steam-link";
