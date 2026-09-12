import {
  getExifOrientation,
  orientationSwapsDimensions,
  applyOrientationTransform,
  ORIENTATION_NORMAL,
} from "@shared/exif";

/**
 * 画像ファイルを EXIF Orientation に従って正立化し、
 * dataURL（base64）として返す。
 *
 * - スマホ写真は長辺2048pxを上限に縮小し、アップロード後のPDF生成負荷を抑える。
 * - EXIF向き補正と縮小を1回のcanvas描画で行い、JPEGとして書き出す。
 *
 * 失敗時は元ファイルの dataURL にフォールバックする。
 */
export async function fileToUprightDataUrl(
  file: File,
  quality = 0.86,
  maxEdge = 2048,
): Promise<{ dataUrl: string; mimeType: string }> {
  const rawDataUrl = await readAsDataUrl(file);

  // 画像以外はそのまま
  if (!file.type.startsWith("image/")) {
    return { dataUrl: rawDataUrl, mimeType: file.type || "application/octet-stream" };
  }

  let orientation = ORIENTATION_NORMAL;
  // EXIF は基本 JPEG のみ
  if (file.type === "image/jpeg" || file.type === "image/jpg") {
    try {
      const buffer = await file.arrayBuffer();
      orientation = getExifOrientation(buffer);
    } catch {
      orientation = ORIENTATION_NORMAL;
    }
  }

  try {
    const img = await loadImage(rawDataUrl);
    const sourceWidth = img.naturalWidth || img.width;
    const sourceHeight = img.naturalHeight || img.height;
    if (!sourceWidth || !sourceHeight) {
      return { dataUrl: rawDataUrl, mimeType: file.type || "image/jpeg" };
    }

    const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
    const drawWidth = Math.max(1, Math.round(sourceWidth * scale));
    const drawHeight = Math.max(1, Math.round(sourceHeight * scale));
    const needsResize = scale < 1;

    // 小さく、向き補正も不要な画像は再圧縮せず保持する。
    if (orientation === ORIENTATION_NORMAL && !needsResize && file.size <= 1_500_000) {
      return { dataUrl: rawDataUrl, mimeType: file.type || "image/jpeg" };
    }

    const swap = orientationSwapsDimensions(orientation);
    const canvas = document.createElement("canvas");
    canvas.width = swap ? drawHeight : drawWidth;
    canvas.height = swap ? drawWidth : drawHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return { dataUrl: rawDataUrl, mimeType: file.type || "image/jpeg" };
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    applyOrientationTransform(ctx, orientation, drawWidth, drawHeight);
    ctx.drawImage(img, 0, 0, drawWidth, drawHeight);
    ctx.restore();
    const outUrl = canvas.toDataURL("image/jpeg", quality);
    canvas.width = 0;
    canvas.height = 0;
    return { dataUrl: outUrl, mimeType: "image/jpeg" };
  } catch {
    // 何かあれば元のまま
    return { dataUrl: rawDataUrl, mimeType: file.type || "image/jpeg" };
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}
