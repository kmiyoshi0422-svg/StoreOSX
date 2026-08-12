import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { registerCalendarFeedRoutes } from "../calendarFeedRoutes.js";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerCalendarFeedRoutes(app);

  // Scheduled tasks (Heartbeat callbacks)
  app.post("/api/scheduled/monthly-expense-report", async (_req, res) => {
    try {
      const { generateMonthlyExpenseReport } = await import("../scheduledTasks");
      await generateMonthlyExpenseReport();
      res.json({ ok: true });
    } catch (err) {
      console.error("Monthly expense report failed:", err);
      res.status(500).json({ ok: false, error: String(err) });
    }
  });
  // 夜間報告書PDF生成＆管理者通知
  app.post("/api/scheduled/generate-report-pdfs", async (_req, res) => {
    try {
      const { generateReportPdfs } = await import("../scheduledTasks");
      await generateReportPdfs();
      res.json({ ok: true });
    } catch (err) {
      console.error("Report PDF generation failed:", err);
      res.status(500).json({ ok: false, error: String(err) });
    }
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
