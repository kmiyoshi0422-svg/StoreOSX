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
 * - JPEG 以外、または向き補正が不要(orientation=1)な場合は、
 *   そのまま FileReader で読み込んだ dataURL を返す（再エンコードしない）。
 * - 補正が必要な場合は canvas に正しい向きで描画し、JPEG として書き出す。
 *
 * 失敗時は元ファイルの dataURL にフォールバックする。
 */
export async function fileToUprightDataUrl(
  file: File,
  quality = 0.92,
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

  if (orientation === ORIENTATION_NORMAL) {
    // 補正不要: 元のまま（再エンコードしない＝劣化・サイズ増を避ける）
    return { dataUrl: rawDataUrl, mimeType: file.type || "image/jpeg" };
  }

  try {
    const img = await loadImage(rawDataUrl);
    const swap = orientationSwapsDimensions(orientation);
    const canvas = document.createElement("canvas");
    canvas.width = swap ? img.naturalHeight : img.naturalWidth;
    canvas.height = swap ? img.naturalWidth : img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return { dataUrl: rawDataUrl, mimeType: file.type || "image/jpeg" };
    }
    ctx.save();
    applyOrientationTransform(ctx, orientation, img.naturalWidth, img.naturalHeight);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
    const outUrl = canvas.toDataURL("image/jpeg", quality);
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
