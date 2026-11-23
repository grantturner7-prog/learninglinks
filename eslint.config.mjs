import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // These are browser globals (window.status, window.event, ...). A forgotten local variable with one of these
    // names type-checks and even works in a browser, then throws ReferenceError during server rendering.
    rules: { "no-restricted-globals": ["error", "status", "event", "name", "length", "location"] },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "drizzle/**", ".data/**", "coverage/**", "public/vendor/**", "docs/demo/**", "docs/review/**"]),
]);
