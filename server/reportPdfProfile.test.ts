import { describe, expect, it } from "vitest";
import { getReportPdfProfile } from "../client/src/lib/reportPdfProfile";

describe("getReportPdfProfile", () => {
  it("44枚規模の報告書はメモリ優先プロファイルを使う", () => {
    const profile = getReportPdfProfile(12, 44, false);
    expect(profile.renderScale).toBe(1);
    expect(profile.maxImageEdge).toBe(1024);
    expect(profile.imageConcurrency).toBe(2);
  });

  it("少数写真は可読性を維持した高品質プロファイルを使う", () => {
    const profile = getReportPdfProfile(3, 6, false);
    expect(profile.renderScale).toBe(1.7);
    expect(profile.maxImageEdge).toBe(1600);
    expect(profile.jpegQuality).toBeGreaterThanOrEqual(0.8);
  });

  it("低メモリ端末では写真枚数が少なくても安全側に倒す", () => {
    const profile = getReportPdfProfile(3, 6, true);
    expect(profile.renderScale).toBe(1);
    expect(profile.imageConcurrency).toBe(2);
  });
});

