import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);
const exclusiveFiles = ["server/responsibilityRoster.test.ts", "server/cases.test.ts"];

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    // 同じ実DBの名簿行を未コミットのまま検証するファイルは他ファイルと重ねない。
    // 全体収支の増減を検証するファイルも、他fixtureの作成/削除途中を集計させない。
    projects: [
      { extends: true, test: { name: "roster-rollback", include: [exclusiveFiles[0]], sequence: { groupOrder: 0 } } },
      { extends: true, test: { name: "standard", include: ["server/**/*.test.ts", "server/**/*.spec.ts"], exclude: exclusiveFiles, sequence: { groupOrder: 1 } } },
      { extends: true, test: { name: "cases-integration", include: [exclusiveFiles[1]], sequence: { groupOrder: 2 } } },
    ],
  },
});
