import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // The web app's "@/..." import alias (apps/web/tsconfig.json), for route handler tests.
  resolve: { alias: { "@": fileURLToPath(new URL("./apps/web", import.meta.url)) } },
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/.next/**"],
    passWithNoTests: true,
  },
});
