import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { createHeartbeatJob, listHeartbeatJobs } from "./heartbeat";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  // Heartbeat: 月次経費レポートの定期タスク登録
  registerMonthlyExpenseReport: adminProcedure
    .mutation(async ({ ctx }) => {
      const result = await createHeartbeatJob(
        {
          name: "monthly-expense-report",
          cron: "0 0 9 1 * *", // 毎月1日 9:00 UTC (JST 18:00)
          path: "/api/scheduled/monthly-expense-report",
          method: "POST",
          description: "月次経費レポート自動生成",
        },
        "" // owner session
      );
      return { taskUid: result.taskUid, nextExecutionAt: result.nextExecutionAt };
    }),

  // Heartbeat: 夜間報告書完了通知の定期タスク登録
  registerNightlyReportNotify: adminProcedure
    .mutation(async ({ ctx }) => {
      const result = await createHeartbeatJob(
        {
          name: "nightly-report-pdf-notify",
          cron: "0 0 17 * * *", // 毎日 17:00 UTC (JST 2:00)
          path: "/api/scheduled/generate-report-pdfs",
          method: "POST",
          description: "夜間報告書完了通知（JST 2:00実行）",
        },
        "" // owner session
      );
      return { taskUid: result.taskUid, nextExecutionAt: result.nextExecutionAt };
    }),

  listScheduledJobs: adminProcedure
    .query(async () => {
      const result = await listHeartbeatJobs("");
      return result;
    }),
});
