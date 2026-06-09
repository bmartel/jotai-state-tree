import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "react": path.resolve(__dirname, "./node_modules/react"),
      "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
      "jotai": path.resolve(__dirname, "./node_modules/jotai"),
      "jotai-state-tree/react": path.resolve(__dirname, "./src/react.ts"),
      "jotai-state-tree": path.resolve(__dirname, "./src/index.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    testTimeout: 30000,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environmentMatchGlobs: [
      // Use jsdom for React tests
      ["src/**/*.react.test.tsx", "jsdom"],
    ],
    execArgv: ["--expose-gc"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "json-summary"],
    },
  },
});
