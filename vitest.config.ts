import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environmentMatchGlobs: [
      // Use jsdom for React tests
      ["src/**/*.react.test.tsx", "jsdom"],
    ],
    execArgv: ["--expose-gc"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
});
