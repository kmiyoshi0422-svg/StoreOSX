import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
const storageProxySource = readFileSync(
  new URL("./_core/storageProxy.ts", import.meta.url),
  "utf8",
);
const storeHistorySource = readFileSync(
  new URL("../client/src/pages/CaseDetailStoreHistoryTab.tsx", import.meta.url),
  "utf8",
);

describe("写真表示URL契約", () => {
  it("案件写真APIは保存済みURLを安定した読み取りURLへ正規化する", () => {
    expect(routerSource).toMatch(
      /getPhotosByCaseId\(input\.caseId\)[\s\S]*photoRows\.map\(withReadableFileUrl\)/,
    );
    expect(routerSource).toContain("photos: photoRows.map(withReadableFileUrl)");
  });

  it("店舗履歴は実在しないapi/storage経路ではなくAPI返却URLを使う", () => {
    expect(storeHistorySource).not.toContain("/api/storage/");
    expect(storeHistorySource).toContain("url: p.fileUrl");
    expect(storeHistorySource).toContain("src={photo.fileUrl}");
  });

  it("旧画面キャッシュ向けapi/storage URLも正規ストレージプロキシで読める", () => {
    expect(storageProxySource).toContain('app.get("/manus-storage/*", handleStorageRead)');
    expect(storageProxySource).toContain('app.get("/api/storage/*", handleStorageRead)');
  });
});
