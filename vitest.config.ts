import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/.next/**"],
    // Phase C ships no tests; the first ones arrive with the learning engine in Phase D.
    passWithNoTests: true,
  },
});
