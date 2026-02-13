declare module "node-steam-openid" {
  interface SteamAuthOptions {
    realm: string;
    returnUrl: string;
    apiKey: string;
  }

  interface SteamUser {
    steamid: string;
    username: string;
    name?: string;
    profile?: { url?: string };
    avatar?: { small?: string; medium?: string; large?: string };
    _json?: unknown;
  }

  export default class SteamAuth {
    constructor(options: SteamAuthOptions);
    getRedirectUrl(): Promise<string>;
    authenticate(req: { url: string }): Promise<SteamUser>;
  }
}
