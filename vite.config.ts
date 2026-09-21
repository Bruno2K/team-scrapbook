import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

function releaseMetadata(environment: NodeJS.ProcessEnv): Plugin {
  const apiBaseUrl = (environment.VITE_API_URL ?? "").replace(/\/+$/, "");
  const gitSha = environment.VERCEL_GIT_COMMIT_SHA ?? environment.GIT_SHA ?? "unknown";
  const deploymentId = environment.VERCEL_DEPLOYMENT_ID ?? "unknown";

  return {
    name: "team-scrapbook-release-metadata",
    transformIndexHtml() {
      return [
        {
          tag: "meta",
          attrs: { name: "team-scrapbook-app", content: "team-scrapbook-frontend" },
          injectTo: "head",
        },
        {
          tag: "meta",
          attrs: { name: "team-scrapbook-api-base", content: apiBaseUrl },
          injectTo: "head",
        },
        {
          tag: "meta",
          attrs: { name: "team-scrapbook-git-sha", content: gitSha },
          injectTo: "head",
        },
        {
          tag: "meta",
          attrs: { name: "team-scrapbook-deployment-id", content: deploymentId },
          injectTo: "head",
        },
      ];
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const environment = { ...loadEnv(mode, process.cwd(), ""), ...process.env };

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
      proxy: {
        "/auth": {
          target: "http://localhost:3000",
          changeOrigin: true,
        },
      },
    },
    plugins: [react(), releaseMetadata(environment), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
