import { defineConfig } from "vitest/config";
import path from "node:path";
import { disposableDatabase } from "./tests/support/disposable-database";
disposableDatabase();
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: {
    environment: "node",
    include: ["tests/**/*.integration.test.ts"],
    setupFiles: ["./tests/support/integration-setup.ts"],
    fileParallelism: false
  }
});
