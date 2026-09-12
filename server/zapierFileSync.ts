import type { Case, Document } from "../drizzle/schema";
import {
  getAppSetting,
  markZapierFileSyncAttempt,
  updateZapierFileSyncForEvent,
} from "./db";
import { storageGetSignedUrl } from "./storage";

export const ZAPIER_FILE_WEBHOOK_SETTING = "zapier_file_webhook_url";
export const ZAPIER_FILE_TABLE_ID = "01M2AS20424Z7E7P4GT4197QYC";
export const DEFAULT_STOREOSX_PUBLIC_ORIGIN = "https://plenuscbk-l2kpa2gk.manus.space";

const WEBHOOK_TIMEOUT_MS = 12_000;

export type ZapierFilePayload = {
  event_id: string;
  callback_token: string;
  callback_basic_auth: string;
  sync_id: number;
  document_id: number;
  case_id: number | null;
  request_number: string | null;
  store_name: string | null;
  file_name: string;
  file_stem: string;
  file_extension: string;
  mime_type: string | null;
  file_size: number | null;
  category: string;
  tags: string[];
  memo: string | null;
  source_file_url: string;
  storeosx_url: string;
  callback_url: string;
  zapier_table_id: string;
  uploaded_at: string;
};

export function isAllowedZapierWebhookUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.hostname === "hooks.zapier.com"
      && url.pathname.startsWith("/hooks/catch/");
  } catch {
    return false;
  }
}

export function getStoreOSXPublicOrigin(): string {
  const candidate = (process.env.STOREOSX_PUBLIC_ORIGIN || DEFAULT_STOREOSX_PUBLIC_ORIGIN).trim();
  const url = new URL(candidate);
  if (url.protocol !== "https:") throw new Error("STOREOSX_PUBLIC_ORIGIN must use HTTPS");
  return url.origin;
}

export function parseDocumentTags(tags: string | null | undefined): string[] {
  if (!tags) return [];
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === "string") : [];
  } catch {
    return [];
  }
}

export function splitDocumentFileName(fileName: string): {
  fileStem: string;
  fileExtension: string;
} {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === fileName.length - 1) {
    return { fileStem: fileName, fileExtension: "" };
  }
  return {
    fileStem: fileName.slice(0, lastDot),
    fileExtension: fileName.slice(lastDot + 1),
  };
}

export function buildZapierFilePayload(input: {
  sync: { id: number; eventId: string; callbackToken: string };
  document: Document;
  caseData?: Case | null;
  sourceFileUrl: string;
  origin: string;
}): ZapierFilePayload {
  const { sync, document, caseData, sourceFileUrl, origin } = input;
  const { fileStem, fileExtension } = splitDocumentFileName(document.fileName);
  return {
    event_id: sync.eventId,
    callback_token: sync.callbackToken,
    callback_basic_auth: `sync:${sync.callbackToken}`,
    sync_id: sync.id,
    document_id: document.id,
    case_id: document.caseId ?? null,
    request_number: caseData?.requestNumber ?? null,
    store_name: caseData?.storeName ?? null,
    file_name: document.fileName,
    file_stem: fileStem,
    file_extension: fileExtension,
    mime_type: document.mimeType ?? null,
    file_size: document.fileSize ?? null,
    category: document.category,
    tags: parseDocumentTags(document.tags),
    memo: document.memo ?? null,
    source_file_url: sourceFileUrl,
    storeosx_url: origin ? `${origin}/document-library` : "",
    callback_url: `${origin}/api/zapier/file-sync/callback`,
    zapier_table_id: ZAPIER_FILE_TABLE_ID,
    uploaded_at: document.createdAt.toISOString(),
  };
}

export async function getZapierFileSyncConfig() {
  const webhookUrl = (await getAppSetting<string>(ZAPIER_FILE_WEBHOOK_SETTING))?.trim() || "";
  return {
    configured: isAllowedZapierWebhookUrl(webhookUrl),
    webhookUrl,
    tableId: ZAPIER_FILE_TABLE_ID,
  };
}

export async function dispatchZapierFileSync(input: {
  sync: { id: number; eventId: string; callbackToken: string };
  document: Document;
  caseData?: Case | null;
}): Promise<{ status: "sent" | "failed" | "skipped"; error?: string }> {
  const config = await getZapierFileSyncConfig();
  if (!config.configured) {
    const error = "Zapier Catch Hook URLが未設定です";
    await updateZapierFileSyncForEvent(input.sync.id, input.sync.eventId, { status: "skipped", lastError: error });
    return { status: "skipped", error };
  }

  await markZapierFileSyncAttempt(input.sync.id);

  try {
    const sourceFileUrl = await storageGetSignedUrl(input.document.fileKey);
    const payload = buildZapierFilePayload({
      ...input,
      sourceFileUrl,
      origin: getStoreOSXPublicOrigin(),
    });
    const response = await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Zapier webhook returned ${response.status}`);
    }

    await updateZapierFileSyncForEvent(input.sync.id, input.sync.eventId, { status: "sent", lastError: null });
    return { status: "sent" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateZapierFileSyncForEvent(input.sync.id, input.sync.eventId, { status: "failed", lastError: message.slice(0, 2000) });
    return { status: "failed", error: message };
  }
}
