import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const exclude = ["**/node_modules/**", "**/dist/**", "**/out/**", "**/release/**", "tests/e2e/**"];
const restoreLatency = [
  "tools/ventas/src/backend/worker-runtime.test.ts",
  "tools/ventas/src/backend/backup-cancel.test.ts",
  "tools/ventas/src/backend/backup-native-load.test.ts",
];

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
          sequence: { groupOrder: 1 },
          environment: "node",
          include: [
            "apps/desktop/src/main/**/*.test.ts",
            "apps/desktop/src/shared/**/*.test.ts",
            "packages/*/src/**/*.test.ts",
            "tools/*/src/backend/**/*.test.ts",
            "tools/*/tests/**/*.test.ts",
            "tests/unit/**/*.test.ts",
            "scripts/**/*.test.ts",
          ],
          exclude: [...exclude, ...restoreLatency],
        },
      },
      {
        extends: true,
        plugins: [react()],
        test: {
          name: "dom",
          sequence: { groupOrder: 1 },
          environment: "jsdom",
          include: [
            "apps/desktop/src/renderer/**/*.test.{ts,tsx}",
            "packages/*/src/**/*.test.tsx",
            "packages/ui/gallery/**/*.test.tsx",
            "tools/*/src/ui/**/*.test.{ts,tsx}",
          ],
          exclude,
          setupFiles: ["tests/setup/dom.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "restore-latency",
          environment: "node",
          include: restoreLatency,
          exclude,
          fileParallelism: false,
          sequence: { groupOrder: 2 },
        },
      },
    ],
  },
});
