import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    // Runs the test/*.test-d.ts type assertions alongside the runtime suites.
    typecheck: {
      enabled: true,
    },
    coverage: {
      provider: "v8",
      include: ["src/**"],
      // M4 hardening: src/ stays fully covered (PLAN §5).
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
