// PDFに埋め込まれた画像（現況写真など）をNode環境で抽出するユーティリティ。
// Cloud Run の Node 専用ランタイムで動くよう、pdfjs-dist(legacy) + jpeg-js のみを使う。
// poppler などのネイティブバイナリには依存しない。

import jpeg from "jpeg-js";

export type ExtractedImage = {
  /** JPEGバイナリ */
  data: Buffer;
  width: number;
  height: number;
  /** 何ページ目から取り出したか（1始まり） */
  page: number;
};

export type ExtractOptions = {
  /** これより小さい画像は除外（ロゴ・アイコン対策）。幅・高さどちらか一方でも下回れば除外 */
  minWidth?: number;
  minHeight?: number;
  /** 最大抽出枚数（暴走防止） */
  maxImages?: number;
  /** JPEG品質 */
  quality?: number;
};

// pdfjs の ImageKind: 1=GRAYSCALE_1BPP, 2=RGB_24BPP, 3=RGBA_32BPP
function toRgba(img: {
  width: number;
  height: number;
  kind: number;
  data: Uint8Array | Uint8ClampedArray;
}): { width: number; height: number; data: Buffer } {
  const { width, height, kind, data } = img;
  if (kind === 3) {
    return { width, height, data: Buffer.from(data) };
  }
  const out = Buffer.alloc(width * height * 4);
  if (kind === 2) {
    for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
      out[j] = data[i];
      out[j + 1] = data[i + 1];
      out[j + 2] = data[i + 2];
      out[j + 3] = 255;
    }
    return { width, height, data: out };
  }
  if (kind === 1) {
    const bytesPerRow = Math.ceil(width / 8);
    let p = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const byteIndex = y * bytesPerRow + (x >> 3);
        const bit = (data[byteIndex] >> (7 - (x & 7))) & 1;
        const v = bit ? 255 : 0;
        out[p++] = v;
        out[p++] = v;
        out[p++] = v;
        out[p++] = 255;
      }
    }
    return { width, height, data: out };
  }
  throw new Error(`unsupported image kind: ${kind}`);
}

/**
 * PDFバイナリから埋め込み画像を抽出してJPEGバッファの配列で返す。
 * 抽出に失敗した画像はスキップし、エラーで全体を止めない。
 */
export async function extractPdfEmbeddedImages(
  pdfBuffer: Buffer | Uint8Array,
  options: ExtractOptions = {},
): Promise<ExtractedImage[]> {
  const minWidth = options.minWidth ?? 200;
  const minHeight = options.minHeight ?? 200;
  const maxImages = options.maxImages ?? 30;
  const quality = options.quality ?? 82;

  // legacy ビルドは Node 環境（DOM なし）向け
  const pdfjsLib: any = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // pdfjs は Node の Buffer を拒否する場合があるため、常に素の Uint8Array にコピーする
  const src =
    pdfBuffer instanceof Uint8Array ? pdfBuffer : new Uint8Array(pdfBuffer);
  const data = new Uint8Array(src.length);
  data.set(src);

  const doc = await pdfjsLib.getDocument({
    data,
    disableFontFace: true,
    useSystemFonts: false,
    // 警告ログを抑制
    verbosity: 0,
  }).promise;

  const OPS = pdfjsLib.OPS;
  const results: ExtractedImage[] = [];
  // 同一画像が複数ページで参照されるケースの重複除去（サイズ＋先頭バイト簡易ハッシュ）
  const seen = new Set<string>();

  for (let pno = 1; pno <= doc.numPages; pno++) {
    if (results.length >= maxImages) break;
    const page = await doc.getPage(pno);
    const ops = await page.getOperatorList();

    for (let i = 0; i < ops.fnArray.length; i++) {
      if (results.length >= maxImages) break;
      const fn = ops.fnArray[i];
      if (
        fn !== OPS.paintImageXObject &&
        fn !== OPS.paintJpegXObject &&
        fn !== OPS.paintImageXObjectRepeat
      ) {
        continue;
      }
      const name = ops.argsArray[i][0];
      try {
        const img: any = await new Promise((resolve, reject) => {
          try {
            page.objs.get(name, resolve);
          } catch (e) {
            reject(e);
          }
          setTimeout(() => reject(new Error("image fetch timeout")), 8000);
        });
        if (!img || !img.width || !img.height || !img.data) continue;
        if (img.width < minWidth || img.height < minHeight) continue;

        const sig = `${img.width}x${img.height}-${img.data.length}-${img.data[0]}-${img.data[img.data.length - 1]}`;
        if (seen.has(sig)) continue;
        seen.add(sig);

        const rgba = toRgba(img);
        const enc = jpeg.encode(
          { data: rgba.data, width: rgba.width, height: rgba.height },
          quality,
        );
        results.push({
          data: Buffer.from(enc.data),
          width: rgba.width,
          height: rgba.height,
          page: pno,
        });
      } catch {
        // この画像はスキップ
      }
    }
    // ページのリソースを解放
    page.cleanup();
  }

  try {
    await doc.cleanup();
    await doc.destroy();
  } catch {
    /* noop */
  }

  return results;
}
