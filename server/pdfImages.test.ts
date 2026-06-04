import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { extractPdfEmbeddedImages } from "./_core/pdfImages";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, "__fixtures__", "sample-with-photos.pdf");

describe("extractPdfEmbeddedImages", () => {
  it("実物の依頼PDFから埋め込み現況写真をJPEGとして抽出できる", async () => {
    const buf = fs.readFileSync(FIXTURE);
    const images = await extractPdfEmbeddedImages(buf, {
      minWidth: 200,
      minHeight: 200,
      maxImages: 30,
      quality: 82,
    });

    // このサンプルPDFには4枚の現況写真が埋め込まれている
    expect(images.length).toBe(4);

    for (const img of images) {
      // 妥当なサイズ
      expect(img.width).toBeGreaterThanOrEqual(200);
      expect(img.height).toBeGreaterThanOrEqual(200);
      // JPEGマジックナンバー(FF D8 FF)で始まる
      expect(img.data[0]).toBe(0xff);
      expect(img.data[1]).toBe(0xd8);
      expect(img.data[2]).toBe(0xff);
      // それなりのバイト数がある
      expect(img.data.length).toBeGreaterThan(1000);
      // ページ番号は1始まりで妥当
      expect(img.page).toBeGreaterThanOrEqual(1);
    }
  }, 30000);

  it("最小サイズの閾値を大きくすると小さい画像は除外される", async () => {
    const buf = fs.readFileSync(FIXTURE);
    // 全画像が 768x1024 / 1024x768 のため、2000px以上を要求すると0枚になる
    const images = await extractPdfEmbeddedImages(buf, {
      minWidth: 2000,
      minHeight: 2000,
    });
    expect(images.length).toBe(0);
  }, 30000);

  it("maxImagesで抽出枚数を制限できる", async () => {
    const buf = fs.readFileSync(FIXTURE);
    const images = await extractPdfEmbeddedImages(buf, {
      minWidth: 200,
      minHeight: 200,
      maxImages: 2,
    });
    expect(images.length).toBe(2);
  }, 30000);

  it("画像を含まない不正なバッファでもエラーを投げず空配列を返す", async () => {
    // 最小限の有効なPDF（画像なし）
    const emptyPdf = Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
        "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
        "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n" +
        "xref\n0 4\n0000000000 65535 f \n" +
        "trailer<</Size 4/Root 1 0 R>>\nstartxref\n0\n%%EOF",
    );
    const images = await extractPdfEmbeddedImages(emptyPdf);
    expect(Array.isArray(images)).toBe(true);
    expect(images.length).toBe(0);
  }, 30000);
});
