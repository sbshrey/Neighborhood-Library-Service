import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
    exclude: ["tests/**/*.spec.ts", "node_modules", ".next"],
    setupFiles: ["./tests/unit/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: [
        "lib/**/*.ts",
        "components/**/*.tsx",
        "app/login/page.tsx",
        "app/catalog/page.tsx",
        "app/fines/page.tsx",
      ],
      exclude: ["**/*.d.ts"],
    },
  },
});
