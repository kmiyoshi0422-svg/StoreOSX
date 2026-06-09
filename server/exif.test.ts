import { describe, it, expect } from "vitest";
import {
  getExifOrientation,
  orientationSwapsDimensions,
  applyOrientationTransform,
  ORIENTATION_NORMAL,
} from "../shared/exif";

// 最小のJPEG(APP1/Exif)バイト列を生成して Orientation を埋め込むヘルパ
function buildJpegWithOrientation(orientation: number, little = true): ArrayBuffer {
  // TIFFヘッダ + 1エントリ(Orientation) のEXIFを構築
  const tiff: number[] = [];
  // バイトオーダー
  if (little) {
    tiff.push(0x49, 0x49); // II
  } else {
    tiff.push(0x4d, 0x4d); // MM
  }
  // 0x002A
  push16(tiff, 0x2a, little);
  // 0th IFD offset = 8
  push32(tiff, 8, little);
  // entries = 1
  push16(tiff, 1, little);
  // tag 0x0112 (Orientation)
  push16(tiff, 0x0112, little);
  // type = 3 (SHORT)
  push16(tiff, 3, little);
  // count = 1
  push32(tiff, 1, little);
  // value (SHORT は先頭2バイトに格納、残り2バイトパディング)
  push16(tiff, orientation, little);
  push16(tiff, 0, little);
  // next IFD offset = 0
  push32(tiff, 0, little);

  const exifPayload: number[] = [
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
    ...tiff,
  ];

  const app1Length = exifPayload.length + 2; // length自身2バイトを含む
  const bytes: number[] = [
    0xff, 0xd8, // SOI
    0xff, 0xe1, // APP1
    (app1Length >> 8) & 0xff,
    app1Length & 0xff,
    ...exifPayload,
    0xff, 0xd9, // EOI
  ];
  return new Uint8Array(bytes).buffer;
}

function push16(arr: number[], value: number, little: boolean) {
  if (little) {
    arr.push(value & 0xff, (value >> 8) & 0xff);
  } else {
    arr.push((value >> 8) & 0xff, value & 0xff);
  }
}
function push32(arr: number[], value: number, little: boolean) {
  if (little) {
    arr.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
  } else {
    arr.push((value >> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff);
  }
}

describe("getExifOrientation", () => {
  it("非JPEG(マジックナンバー不一致)は1を返す", () => {
    const buf = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer; // PNG
    expect(getExifOrientation(buf)).toBe(ORIENTATION_NORMAL);
  });

  it("空バッファは1を返す", () => {
    expect(getExifOrientation(new ArrayBuffer(0))).toBe(1);
  });

  it("Orientation=6(時計90)をlittle-endianで読み取れる", () => {
    expect(getExifOrientation(buildJpegWithOrientation(6, true))).toBe(6);
  });

  it("Orientation=8(反時計90)をbig-endianで読み取れる", () => {
    expect(getExifOrientation(buildJpegWithOrientation(8, false))).toBe(8);
  });

  it("Orientation=1(正立)をそのまま返す", () => {
    expect(getExifOrientation(buildJpegWithOrientation(1, true))).toBe(1);
  });

  it("Orientation=3(180度)を読み取れる", () => {
    expect(getExifOrientation(buildJpegWithOrientation(3, true))).toBe(3);
  });

  it("EXIFが無いJPEG(SOIのみ)は1を返す", () => {
    const buf = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer;
    expect(getExifOrientation(buf)).toBe(1);
  });

  it("範囲外の値(例:99)は1にフォールバック", () => {
    expect(getExifOrientation(buildJpegWithOrientation(99, true))).toBe(1);
  });
});

describe("orientationSwapsDimensions", () => {
  it("5,6,7,8 は幅高さが入れ替わる", () => {
    [5, 6, 7, 8].forEach((o) => expect(orientationSwapsDimensions(o)).toBe(true));
  });
  it("1,2,3,4 は入れ替わらない", () => {
    [1, 2, 3, 4].forEach((o) => expect(orientationSwapsDimensions(o)).toBe(false));
  });
});

describe("applyOrientationTransform", () => {
  it("各orientationで適切なtransform引数を渡す（呼び出し回数）", () => {
    const calls: number[][] = [];
    const ctx = {
      transform: (a: number, b: number, c: number, d: number, e: number, f: number) => {
        calls.push([a, b, c, d, e, f]);
      },
    };
    // orientation=6 (時計90): transform(0,1,-1,0,height,0)
    applyOrientationTransform(ctx, 6, 100, 200);
    expect(calls[0]).toEqual([0, 1, -1, 0, 200, 0]);
  });

  it("orientation=1 は transform を呼ばない", () => {
    let called = false;
    const ctx = { transform: () => { called = true; } };
    applyOrientationTransform(ctx, 1, 100, 200);
    expect(called).toBe(false);
  });

  it("orientation=3 (180度) は transform(-1,0,0,-1,width,height)", () => {
    const calls: number[][] = [];
    const ctx = {
      transform: (a: number, b: number, c: number, d: number, e: number, f: number) => {
        calls.push([a, b, c, d, e, f]);
      },
    };
    applyOrientationTransform(ctx, 3, 100, 200);
    expect(calls[0]).toEqual([-1, 0, 0, -1, 100, 200]);
  });
});
