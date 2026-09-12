import { describe, expect, it } from "vitest";
import type { Case, Document, ZapierFileSync } from "../drizzle/schema";
import {
  buildZapierFilePayload,
  isAllowedZapierWebhookUrl,
  parseDocumentTags,
  splitDocumentFileName,
  ZAPIER_FILE_TABLE_ID,
} from "./zapierFileSync";
import { extractZapierCallbackToken } from "./zapierFileSyncRoutes";

describe("Zapier file sync", () => {
  it("accepts only HTTPS Catch Hook URLs on hooks.zapier.com", () => {
    expect(isAllowedZapierWebhookUrl("https://hooks.zapier.com/hooks/catch/123/abc/"))
      .toBe(true);
    expect(isAllowedZapierWebhookUrl("http://hooks.zapier.com/hooks/catch/123/abc/"))
      .toBe(false);
    expect(isAllowedZapierWebhookUrl("https://example.com/hooks/catch/123/abc/"))
      .toBe(false);
    expect(isAllowedZapierWebhookUrl("https://hooks.zapier.com/other/path"))
      .toBe(false);
  });

  it("parses only string tags from stored JSON", () => {
    expect(parseDocumentTags('["図面","厨房",3]')).toEqual(["図面", "厨房"]);
    expect(parseDocumentTags("invalid")).toEqual([]);
    expect(parseDocumentTags(null)).toEqual([]);
  });

  it("splits the last file extension for Google Drive naming", () => {
    expect(splitDocumentFileName("現調報告.final.pdf")).toEqual({
      fileStem: "現調報告.final",
      fileExtension: "pdf",
    });
    expect(splitDocumentFileName("README")).toEqual({ fileStem: "README", fileExtension: "" });
    expect(splitDocumentFileName(".env")).toEqual({ fileStem: ".env", fileExtension: "" });
  });

  it("extracts the callback token only from the expected Basic Auth user", () => {
    const token = "123e4567-e89b-12d3-a456-426614174000";
    expect(extractZapierCallbackToken(`Basic ${Buffer.from(`sync:${token}`).toString("base64")}`))
      .toBe(token);
    expect(extractZapierCallbackToken(`Basic ${Buffer.from(`other:${token}`).toString("base64")}`))
      .toBeNull();
    expect(extractZapierCallbackToken("Bearer test")).toBeNull();
  });

  it("builds a complete Zapier payload without embedding file bytes", () => {
    const document = {
      id: 42,
      caseId: 7,
      fileName: "現調報告.pdf",
      fileKey: "documents/7/report.pdf",
      fileUrl: "/manus-storage/documents/7/report.pdf",
      mimeType: "application/pdf",
      fileSize: 12345,
      category: "報告書",
      tags: '["現調","2026"]',
      memo: "初回提出",
      uploadedBy: 1,
      isLocked: 0,
      createdAt: new Date("2026-09-12T12:00:00.000Z"),
    } as Document;
    const caseData = {
      id: 7,
      requestNumber: "REQ-007",
      storeName: "テスト店舗",
    } as Case;
    const sync = {
      id: 9,
      eventId: "event-9",
      callbackToken: "secret-token",
    } as ZapierFileSync;

    const payload = buildZapierFilePayload({
      sync,
      document,
      caseData,
      sourceFileUrl: "https://storage.example.com/signed.pdf",
      origin: "https://store.example.com",
    });

    expect(payload).toMatchObject({
      event_id: "event-9",
      callback_token: "secret-token",
      callback_basic_auth: "sync:secret-token",
      sync_id: 9,
      document_id: 42,
      case_id: 7,
      request_number: "REQ-007",
      store_name: "テスト店舗",
      file_name: "現調報告.pdf",
      file_stem: "現調報告",
      file_extension: "pdf",
      tags: ["現調", "2026"],
      source_file_url: "https://storage.example.com/signed.pdf",
      storeosx_url: "https://store.example.com/document-library",
      callback_url: "https://store.example.com/api/zapier/file-sync/callback",
      zapier_table_id: ZAPIER_FILE_TABLE_ID,
      uploaded_at: "2026-09-12T12:00:00.000Z",
    });
    expect(JSON.stringify(payload)).not.toContain("base64");
  });
});
