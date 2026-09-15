import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globals: true,
    setupFiles: ["./tests/integration/setup.ts"],
    fileParallelism: false,
  },
});
