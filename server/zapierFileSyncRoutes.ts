import type { Express, Request, Response } from "express";
import { z } from "zod";
import {
  getZapierFileSyncByCallbackToken,
  updateZapierFileSyncForEvent,
} from "./db";

const callbackSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("completed"),
    event_id: z.string().uuid(),
    callback_token: z.string().uuid(),
    google_drive_file_id: z.string().min(1).max(255),
    google_drive_url: z.string().url().max(1000).refine((value) => {
      const hostname = new URL(value).hostname;
      return hostname === "drive.google.com" || hostname === "docs.google.com";
    }, "google_drive_url must be a Google Drive URL"),
    zapier_table_record_id: z.string().min(1).max(255),
  }),
  z.object({
    status: z.literal("failed"),
    event_id: z.string().uuid(),
    callback_token: z.string().uuid(),
    error: z.string().min(1).max(2000),
  }),
]);

export function extractZapierCallbackToken(authorization: string | undefined): string | null {
  if (!authorization?.startsWith("Basic ")) return null;
  try {
    const decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 0 || decoded.slice(0, separator) !== "sync") return null;
    const token = decoded.slice(separator + 1);
    return z.string().uuid().safeParse(token).success ? token : null;
  } catch {
    return null;
  }
}

function getCallbackPayload(req: Request): unknown {
  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? req.body as Record<string, unknown>
    : {};
  if (body.callback_token) return body;

  const callbackToken = extractZapierCallbackToken(req.get("authorization"));
  return callbackToken
    ? { ...req.query, callback_token: callbackToken }
    : body;
}

export function registerZapierFileSyncRoutes(app: Express) {
  app.post("/api/zapier/file-sync/callback", async (req: Request, res: Response) => {
    const parsed = callbackSchema.safeParse(getCallbackPayload(req));
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: "invalid callback payload" });
      return;
    }

    const sync = await getZapierFileSyncByCallbackToken(parsed.data.callback_token);
    if (!sync) {
      res.status(404).json({ ok: false, error: "sync record not found" });
      return;
    }
    if (sync.eventId !== parsed.data.event_id) {
      res.status(409).json({ ok: false, error: "stale sync event" });
      return;
    }
    if (sync.status === parsed.data.status) {
      res.json({ ok: true, syncId: sync.id, status: sync.status, duplicate: true });
      return;
    }

    const updateData = parsed.data.status === "completed"
      ? {
          status: "completed" as const,
          googleDriveFileId: parsed.data.google_drive_file_id,
          googleDriveUrl: parsed.data.google_drive_url,
          zapierTableRecordId: parsed.data.zapier_table_record_id,
          lastError: null,
          completedAt: new Date(),
        }
      : {
          status: "failed" as const,
          googleDriveFileId: null,
          googleDriveUrl: null,
          zapierTableRecordId: null,
          lastError: parsed.data.error,
          completedAt: null,
        };
    const updated = await updateZapierFileSyncForEvent(sync.id, parsed.data.event_id, updateData);
    if (!updated) {
      res.status(409).json({ ok: false, error: "sync event changed during callback" });
      return;
    }

    res.json({ ok: true, syncId: sync.id, status: parsed.data.status });
  });
}
