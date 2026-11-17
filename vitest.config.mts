import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // DB integration tests share one Postgres and truncate it, so test files must not run in parallel.
  test: { include: ["tests/**/*.test.ts"], environment: "node", fileParallelism: false },
});
