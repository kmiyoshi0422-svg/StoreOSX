import { describe, expect, it } from "vitest";
import { storageUrlForRead } from "./storage";

describe("storageUrlForRead", () => {
  it("keeps a stable manus-storage URL", () => {
    expect(
      storageUrlForRead(
        "documents/1/original.pdf",
        "/manus-storage/documents/1/report_ab12cd34.pdf",
      ),
    ).toBe("/manus-storage/documents/1/report_ab12cd34.pdf");
  });

  it("extracts a stable path from an absolute application URL", () => {
    expect(
      storageUrlForRead(
        "documents/1/original.pdf",
        "https://store.example.com/manus-storage/documents/1/report_ab12cd34.pdf?download=1",
      ),
    ).toBe("/manus-storage/documents/1/report_ab12cd34.pdf?download=1");
  });

  it("rebuilds a stable URL from fileKey when a legacy signed URL is stored", () => {
    expect(
      storageUrlForRead(
        "documents/shared/manual.pdf",
        "https://signed-storage.example.com/manual.pdf?expires=1",
      ),
    ).toBe("/manus-storage/documents/shared/manual.pdf");
  });

  it("normalizes a leading slash and manus-storage prefix in fileKey", () => {
    expect(storageUrlForRead("/manus-storage/photos/example.jpg", null)).toBe(
      "/manus-storage/photos/example.jpg",
    );
  });

  it("falls back to the legacy URL only when fileKey is unavailable", () => {
    expect(storageUrlForRead(null, "https://legacy.example.com/file.pdf")).toBe(
      "https://legacy.example.com/file.pdf",
    );
  });
});
