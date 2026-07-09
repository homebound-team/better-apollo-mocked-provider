// Ambient types for Vitest's injected globals (vitest.config.ts sets `globals: true`), narrowed to
// what this package's tests use. We declare them by hand rather than pulling in `vitest/globals`
// so we can extend `it` with Homebound's `it.async` helper (assigned in setupTests.ts) — Vitest's
// `TestAPI` is a sealed type alias and can't be module-augmented.
import type * as Vitest from "vitest";

declare global {
  const describe: typeof Vitest.describe;
  const test: typeof Vitest.test;
  const expect: typeof Vitest.expect;
  const beforeEach: typeof Vitest.beforeEach;
  const afterEach: typeof Vitest.afterEach;
  const vi: typeof Vitest.vi;
  const it: typeof Vitest.it & {
    /** Wraps a callback-style `(resolve, reject)` test in a promise; see setupTests.ts. */
    async(
      name: string,
      callback: (resolve: (result?: any) => void, reject: (reason?: any) => void) => any,
      timeout?: number,
    ): void;
  };
}

export {};
