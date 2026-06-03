import { describe, it, expect } from "vitest";
import {
  normalizePhone,
  buildTelHref,
  buildMapDirectionsHref,
} from "@shared/map-actions";

describe("v24: map-actions normalizePhone", () => {
  it("数字と + 以外を除去する", () => {
    expect(normalizePhone("03-1234-5678")).toBe("0312345678");
    expect(normalizePhone("（092）123-4567")).toBe("0921234567");
    expect(normalizePhone("+81 90 1234 5678")).toBe("+819012345678");
  });

  it("null/undefined/空は空文字を返す", () => {
    expect(normalizePhone(null)).toBe("");
    expect(normalizePhone(undefined)).toBe("");
    expect(normalizePhone("")).toBe("");
  });
});

describe("v24: map-actions buildTelHref", () => {
  it("有効な番号は tel: リンクになる", () => {
    expect(buildTelHref("03-1234-5678")).toBe("tel:0312345678");
  });

  it("数字3桁未満や番号なしは null", () => {
    expect(buildTelHref(null)).toBeNull();
    expect(buildTelHref("")).toBeNull();
    expect(buildTelHref("ab")).toBeNull();
    expect(buildTelHref("12")).toBeNull();
  });
});

describe("v24: map-actions buildMapDirectionsHref", () => {
  it("住所があれば住所をエンコードして目的地にする", () => {
    const href = buildMapDirectionsHref({
      address: "福岡県福岡市博多区博多駅前1-1",
      lat: 33.59,
      lng: 130.42,
    });
    expect(href).toContain("https://www.google.com/maps/dir/?api=1&destination=");
    expect(href).toContain(encodeURIComponent("福岡県福岡市博多区博多駅前1-1"));
    // 住所優先なので座標は含まない
    expect(href).not.toContain("33.59,130.42");
  });

  it("住所が無ければ緯度経度を使う", () => {
    const href = buildMapDirectionsHref({
      address: null,
      lat: 33.59,
      lng: 130.42,
    });
    expect(href).toContain("destination=33.59,130.42");
  });

  it("住所も座標も無ければ destination は空", () => {
    const href = buildMapDirectionsHref({ address: "", lat: null, lng: null });
    expect(href).toBe(
      "https://www.google.com/maps/dir/?api=1&destination="
    );
  });
});
