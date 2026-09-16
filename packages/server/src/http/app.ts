import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import { config } from "../config.js";
import { attachRequestId, errorHandler, notFoundHandler } from "./error.js";
import { rateLimit } from "./rateLimit.js";
import { authRouter } from "../routes/auth.js";
import { workspacesRouter } from "../routes/workspaces.js";
import { collectionsRouter } from "../routes/collections.js";
import { requestsRouter } from "../routes/requests.js";
import { environmentsRouter } from "../routes/environments.js";
import { historyRouter } from "../routes/history.js";
import { examplesRouter } from "../routes/examples.js";
import { runnerRouter } from "../routes/runner.js";
import { specsRouter } from "../routes/specs.js";
import { importExportRouter } from "../routes/importExport.js";
import { aiRouter } from "../routes/ai.js";
import { adminRouter } from "../routes/admin.js";
import { mockEndpointHandler } from "../mocks/endpoint.js";

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  app.use(express.json({ limit: "10mb" }));
  app.use(attachRequestId);

  // Health first (no auth, no rate limit).
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Public mock endpoints (no auth). Mounted via `.use` for robust path parsing
  // across Express versions (mock URL: ANY /mock/:mockId/...).
  app.use("/mock", mockEndpointHandler);

  // Auth is rate-limited, everything else is authenticated.
  app.use("/api/auth", rateLimit, authRouter);
  app.use("/api/workspaces", workspacesRouter);
  app.use("/api/collections", collectionsRouter);
  app.use("/api/requests", requestsRouter);
  app.use("/api/environments", environmentsRouter);
  app.use("/api/history", historyRouter);
  app.use("/api/examples", examplesRouter);
  app.use("/api", runnerRouter);
  app.use("/api/specs", specsRouter);
  app.use("/api", importExportRouter);
  app.use("/api/ai", aiRouter);
  app.use("/api/admin", adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}