import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const railwayAuthDestination = "https://dazzling-encouragement-production-fd0f.up.railway.app/auth/:path*";

describe("Vercel auth proxy routing", () => {
  it("rewrites /auth before the SPA fallback, targets Railway, and disables cache", () => {
    const vercel = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8")) as {
      buildCommand: string;
      outputDirectory: string;
      installCommand: string;
      framework: string;
      rewrites: Array<{ source: string; destination: string }>;
      headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
    };
    const authRewriteIndex = vercel.rewrites.findIndex((rule) => rule.source === "/auth/:path*");
    const spaFallbackIndex = vercel.rewrites.findIndex((rule) => (
      rule.source === "/(.*)" && rule.destination === "/index.html"
    ));
    const headerMap = Object.fromEntries(
      (vercel.headers.find((block) => block.source === "/auth/:path*")?.headers ?? [])
        .map((header) => [header.key, header.value]),
    );

    expect(authRewriteIndex).toBe(0);
    expect(spaFallbackIndex).toBe(vercel.rewrites.length - 1);
    expect(vercel.rewrites.some((rule) => rule.source === "/__auth-proxy-proof/echo")).toBe(true);
    expect(vercel.rewrites.find((rule) => rule.source === "/__auth-proxy-proof/echo")?.destination).toMatch(/^https:\/\/httpbingo\.org\//);
    expect(vercel.rewrites[authRewriteIndex]?.destination).toBe(railwayAuthDestination);
    expect(headerMap).toMatchObject({
      "x-vercel-enable-rewrite-caching": "0",
      "Cache-Control": "no-store, private",
      "CDN-Cache-Control": "no-store",
      "Vercel-CDN-Cache-Control": "no-store",
    });
    expect(vercel.buildCommand).toBe("npm run build");
    expect(vercel.outputDirectory).toBe("dist");
    expect(vercel.installCommand).toBe("npm install");
    expect(vercel.framework).toBe("vite");
    expect(vercel.rewrites.some((rule) => rule.source.includes("/socket.io"))).toBe(false);
    expect(vercel.rewrites.filter((rule) => rule.source.startsWith("/auth")).length).toBe(1);
  });
});

describe("Vite local auth proxy", () => {
  it("proxies same-origin /auth to the local backend", () => {
    const source = readFileSync(join(root, "vite.config.ts"), "utf8");
    expect(source).toMatch(/["']\/auth["']/);
    expect(source).toMatch(/target:\s*["']http:\/\/localhost:3000["']/);
  });
});
