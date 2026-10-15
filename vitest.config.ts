import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const exclude = ["**/node_modules/**", "**/dist/**", "**/out/**", "**/release/**", "tests/e2e/**"];

export default defineConfig({
  define: {
    __RELEASES_REPO__: JSON.stringify(""),
  },
  test: {
    passWithNoTests: false,
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: [
            "apps/desktop/src/main/**/*.test.ts",
            "apps/desktop/src/shared/**/*.test.ts",
            "packages/*/src/**/*.test.ts",
            "tools/*/src/backend/**/*.test.ts",
            "tools/*/tests/**/*.test.ts",
            "tests/unit/**/*.test.ts",
          ],
          exclude,
        },
      },
      {
        extends: true,
        plugins: [react()],
        test: {
          name: "dom",
          environment: "jsdom",
          include: [
            "apps/desktop/src/renderer/**/*.test.{ts,tsx}",
            "tools/*/src/ui/**/*.test.{ts,tsx}",
          ],
          exclude,
          setupFiles: ["tests/setup/dom.ts"],
        },
      },
    ],
  },
});
