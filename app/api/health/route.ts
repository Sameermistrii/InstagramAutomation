import { NextResponse } from "next/server";
import Redis from "ioredis";
import { prisma } from "@/lib/db/client";
import { getDMQueue } from "@/lib/queue/client";
import { getWorkerHealth } from "@/lib/ops/worker-health";
import { isInlineProcessing } from "@/lib/runtime-mode";

export const runtime = "nodejs";
// Health must reflect live state (worker heartbeat, queue depth), never a
// cached response, or it reports stale worker start times.
export const dynamic = "force-dynamic";

type CheckStatus = "ok" | "error";

interface HealthCheck {
  status: CheckStatus;
  detail?: string;
}

async function checkDatabase(): Promise<HealthCheck> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok" };
  } catch (error) {
    return {
      status: "error",
      detail: error instanceof Error ? error.message : "Database check failed",
    };
  }
}

async function checkRedis(): Promise<HealthCheck> {
  const client = new Redis(process.env.REDIS_URL ?? "", {
    connectTimeout: 4000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: () => null,
  });
  try {
    const pong = await client.ping();
    return { status: pong === "PONG" ? "ok" : "error", detail: pong };
  } catch (error) {
    return {
      status: "error",
      detail: error instanceof Error ? error.message : "Redis check failed",
    };
  } finally {
    client.disconnect();
  }
}

async function checkQueue(): Promise<HealthCheck & { counts?: unknown }> {
  try {
    const counts = await getDMQueue().getJobCounts(
      "waiting",
      "active",
      "delayed",
      "failed"
    );
    return { status: "ok", counts };
  } catch (error) {
    return {
      status: "error",
      detail: error instanceof Error ? error.message : "Queue check failed",
    };
  }
}

export async function GET() {
  if (isInlineProcessing()) {
    const database = await checkDatabase();
    const skipped = {
      status: "ok" as const,
      detail: "Replies are sent by the web app. A separate worker is not required.",
    };
    const healthy = database.status === "ok";
    return NextResponse.json(
      {
        status: healthy ? "ok" : "degraded",
        checks: {
          database,
          redis: skipped,
          queue: skipped,
          worker: {
            healthy,
            mode: "inline",
            heartbeat: null,
            ageMs: null,
          },
        },
      },
      { status: healthy ? 200 : 503 }
    );
  }

  const [database, redis, queue, worker] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkQueue(),
    getWorkerHealth().catch((error) => ({
      healthy: false,
      heartbeat: null,
      ageMs: null,
      error: error instanceof Error ? error.message : "Worker check failed",
    })),
  ]);

  const healthy =
    database.status === "ok" &&
    redis.status === "ok" &&
    queue.status === "ok" &&
    worker.healthy;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      checks: {
        database,
        redis,
        queue,
        worker,
      },
    },
    { status: healthy ? 200 : 503 }
  );
}
