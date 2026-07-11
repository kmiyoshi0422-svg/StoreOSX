/**
 * ICS カレンダーフィード Express ルート
 * GET /api/calendar/feed/:token.ics
 */
import type { Express, Request, Response } from "express";
import {
  validateCalendarToken,
  generateAllSchedulesFeed,
  generateCaseSchedulesFeed,
} from "./calendarFeed";

export function registerCalendarFeedRoutes(app: Express) {
  // ICSフィードエンドポイント
  app.get("/api/calendar/feed/:token.ics", async (req: Request, res: Response) => {
    try {
      const token = req.params.token;
      if (!token) {
        res.status(400).send("Bad request");
        return;
      }

      const validation = await validateCalendarToken(token);
      if (!validation.valid) {
        res.status(404).send("Calendar feed not found");
        return;
      }

      let icsContent: string;
      if (validation.scope === "case" && validation.caseId) {
        icsContent = await generateCaseSchedulesFeed(validation.caseId);
      } else {
        icsContent = await generateAllSchedulesFeed();
      }

      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader("Content-Disposition", "inline; filename=schedule.ics");
      // キャッシュを短めに設定（Googleカレンダーのポーリング間隔に合わせる）
      res.setHeader("Cache-Control", "public, max-age=300");
      res.send(icsContent);
    } catch (error) {
      console.error("[CalendarFeed] Error:", error);
      res.status(500).send("Internal server error");
    }
  });
}
