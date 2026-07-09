import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    // Keep jest-style globals (describe/it/expect/...) so tests read unchanged; the extra
    // `it.async` helper is wired up in src/setupTests.ts and typed in src/vitest-globals.d.ts.
    globals: true,
    setupFiles: ["./src/setupTests.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
