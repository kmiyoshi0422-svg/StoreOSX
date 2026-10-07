import { beforeEach, describe, expect, it, vi } from "vitest";

const { addedPages, images, saveSpy } = vi.hoisted(() => ({
  addedPages: vi.fn(),
  images: vi.fn(),
  saveSpy: vi.fn(),
}));

vi.mock("jspdf", () => ({
  default: class MockPdf {
    internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
    addPage = addedPages;
    addImage = images;
    save = saveSpy;
  },
}));

import { createReportPdfFromPages } from "../client/src/lib/reportPdfPages";

const jpeg = (n: number) => `data:image/jpeg;base64,${Buffer.from(`page-${n}`).toString("base64")}`;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("報告書の確認済みA4ページからPDFを構成", () => {
  it.each([1, 3, 12, 44])("%iページの画像を順序どおり1回ずつ埋め込む", (count) => {
    const pages = Array.from({ length: count }, (_, i) => jpeg(i));
    createReportPdfFromPages(pages);
    expect(addedPages).toHaveBeenCalledTimes(count - 1);
    expect(images).toHaveBeenCalledTimes(count);
    pages.forEach((page, i) => {
      expect(images).toHaveBeenNthCalledWith(i + 1, page, "JPEG", 0, 0, 210, 297, undefined, "FAST");
    });
  });

  it("プレビュー未完了またはJPEG以外ならPDFを作らない", () => {
    expect(() => createReportPdfFromPages([])).toThrow("プレビュー");
    expect(() => createReportPdfFromPages([jpeg(0), "data:image/png;base64,AAAA"])).toThrow("プレビュー");
    expect(images).not.toHaveBeenCalled();
  });
});
