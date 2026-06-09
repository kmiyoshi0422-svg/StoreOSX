/**
 * EXIF Orientation（向き）に関する純粋ユーティリティ。
 *
 * JPEG のバイト列（ArrayBuffer）から EXIF の Orientation タグ（0x0112）を読み取る。
 * 外部ライブラリ無しで APP1(Exif) セグメントを走査する。
 *
 * Orientation の値の意味（EXIF 仕様）:
 *   1 = 正立（無回転）
 *   2 = 左右反転
 *   3 = 180度回転
 *   4 = 上下反転
 *   5 = 左右反転 + 反時計90度
 *   6 = 時計回り90度
 *   7 = 左右反転 + 時計90度
 *   8 = 反時計回り90度
 */

export const ORIENTATION_NORMAL = 1;

/**
 * JPEG の ArrayBuffer から EXIF Orientation を取得する。
 * 取得できない場合（非JPEG / EXIF無し / 破損）は 1（正立）を返す。
 */
export function getExifOrientation(buffer: ArrayBuffer): number {
  const view = new DataView(buffer);

  // JPEG は 0xFFD8 で始まる
  if (view.byteLength < 2 || view.getUint16(0, false) !== 0xffd8) {
    return ORIENTATION_NORMAL;
  }

  const length = view.byteLength;
  let offset = 2;

  while (offset + 4 <= length) {
    const marker = view.getUint16(offset, false);
    offset += 2;

    // APP1 マーカー（0xFFE1）に EXIF が入る
    if (marker === 0xffe1) {
      const segmentLength = view.getUint16(offset, false);
      const exifStart = offset + 2;

      // "Exif\0\0" の確認
      if (exifStart + 6 > length) return ORIENTATION_NORMAL;
      if (view.getUint32(exifStart, false) !== 0x45786966) {
        return ORIENTATION_NORMAL; // "Exif"
      }

      // TIFF ヘッダ開始（Exif\0\0 の 6 バイト後）
      const tiffStart = exifStart + 6;
      if (tiffStart + 8 > length) return ORIENTATION_NORMAL;

      // バイトオーダー（II=little-endian, MM=big-endian）
      const endianMarker = view.getUint16(tiffStart, false);
      const little = endianMarker === 0x4949;
      const big = endianMarker === 0x4d4d;
      if (!little && !big) return ORIENTATION_NORMAL;

      // 0th IFD へのオフセット
      const ifdOffset = view.getUint32(tiffStart + 4, little);
      let dirStart = tiffStart + ifdOffset;
      if (dirStart + 2 > length) return ORIENTATION_NORMAL;

      const entries = view.getUint16(dirStart, little);
      dirStart += 2;

      for (let i = 0; i < entries; i++) {
        const entryOffset = dirStart + i * 12;
        if (entryOffset + 12 > length) break;
        const tag = view.getUint16(entryOffset, little);
        if (tag === 0x0112) {
          const value = view.getUint16(entryOffset + 8, little);
          if (value >= 1 && value <= 8) return value;
          return ORIENTATION_NORMAL;
        }
      }
      return ORIENTATION_NORMAL;
    } else if ((marker & 0xff00) !== 0xff00) {
      // マーカーでなければ中断
      break;
    } else {
      // 他のセグメントは長さ分スキップ
      if (offset + 2 > length) break;
      const segmentLength = view.getUint16(offset, false);
      offset += segmentLength;
    }
  }

  return ORIENTATION_NORMAL;
}

/**
 * Orientation 値に応じて、描画後のキャンバスサイズで幅と高さが入れ替わるか判定する。
 * 5,6,7,8 は 90 度系の回転なので入れ替わる。
 */
export function orientationSwapsDimensions(orientation: number): boolean {
  return orientation >= 5 && orientation <= 8;
}

/**
 * canvas 2d コンテキストに対し、Orientation を正立化するための変換を適用する。
 * 呼び出し側で ctx.save()/restore() を管理すること。
 * width/height は「元画像」の幅・高さ（回転前）を渡す。
 */
export function applyOrientationTransform(
  ctx: {
    transform: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
  },
  orientation: number,
  width: number,
  height: number,
): void {
  switch (orientation) {
    case 2:
      // 左右反転
      ctx.transform(-1, 0, 0, 1, width, 0);
      break;
    case 3:
      // 180度
      ctx.transform(-1, 0, 0, -1, width, height);
      break;
    case 4:
      // 上下反転
      ctx.transform(1, 0, 0, -1, 0, height);
      break;
    case 5:
      // 転置（左右反転 + 反時計90）
      ctx.transform(0, 1, 1, 0, 0, 0);
      break;
    case 6:
      // 時計回り90
      ctx.transform(0, 1, -1, 0, height, 0);
      break;
    case 7:
      // 左右反転 + 時計90
      ctx.transform(0, -1, -1, 0, height, width);
      break;
    case 8:
      // 反時計回り90
      ctx.transform(0, -1, 1, 0, 0, width);
      break;
    default:
      // 1 もしくは未知: 無変換
      break;
  }
}
