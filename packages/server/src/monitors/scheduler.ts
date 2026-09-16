import { listDueMonitors } from "./service.js";
import { queryOne } from "../db/connection.js";
import { runCollection } from "../runner/collectionRunner.js";
import { recordMonitorRun } from "./service.js";
import { logger } from "../logger.js";

export interface MonitorScheduler {
  start(): void;
  stop(): void;
}

export function createMonitorScheduler(intervalMs = 60_000): MonitorScheduler {
  let timer: NodeJS.Timeout | undefined;

  async function tick(): Promise<void> {
    try {
      const due = listDueMonitors();
      for (const monitor of due) {
        const owner = queryOne<{ user_id: string }>(
          "SELECT m.user_id FROM workspace_members m WHERE m.workspace_id = ? AND (m.role = 'owner' OR m.role = 'admin') LIMIT 1",
          monitor.workspace_id,
        );
        if (!owner) continue;
        try {
          const report = await runCollection(owner.user_id, {
            workspaceId: monitor.workspace_id,
            collectionId: monitor.collection_id,
            environmentId: monitor.environment_id ?? undefined,
          });
          const passed = report.summary.failed === 0;
          recordMonitorRun(monitor.id, passed, report.items.at(-1)?.status ?? null, report.summary.duration, { summary: report.summary });
          logger.info("monitor run complete", { monitorId: monitor.id, passed });
        } catch (err) {
          logger.error("monitor run failed", { monitorId: monitor.id, error: err instanceof Error ? err.message : String(err) });
          recordMonitorRun(monitor.id, false, null, 0, { error: err instanceof Error ? err.message : String(err) });
        }
      }
    } catch (err) {
      logger.error("monitor scheduler tick error", { error: err instanceof Error ? err.message : String(err) });
    }
  }

  return {
    start() {
      timer = setInterval(tick, intervalMs);
      timer.unref();
      // Run once shortly after startup.
      setTimeout(tick, 5000).unref();
    },
    stop() {
      if (timer) clearInterval(timer);
    },
  };
}