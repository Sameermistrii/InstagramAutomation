import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { isInlineProcessing } from "@/lib/runtime-mode";
import { getDMQueue, type DmQueueJob } from "./client";

export async function enqueueDm(
  name: string,
  data: DmQueueJob,
  opts?: { delay?: number; jobId?: string }
): Promise<void> {
  const delay = opts?.delay ?? 0;

  if (!isInlineProcessing()) {
    await getDMQueue().add(name, data, {
      delay,
      jobId: opts?.jobId,
    });
    return;
  }

  if (delay > 0) {
    await prisma.scheduledJob
      .create({
        data: {
          name,
          dedupeKey: opts?.jobId,
          payload: data as unknown as Prisma.InputJsonValue,
          runAt: new Date(Date.now() + delay),
        },
      })
      .catch((error: unknown) => {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          return;
        }
        throw error;
      });
    return;
  }

  const { runDmJob } = await import("@/lib/queue/dm-worker");
  await runDmJob(name, data);
}

/** Send delayed jobs whose time has arrived. Safe to run from a cron or a webhook. */
export async function drainScheduledJobs(limit = 15): Promise<number> {
  const due = await prisma.scheduledJob.findMany({
    where: { status: "PENDING", runAt: { lte: new Date() } },
    orderBy: { runAt: "asc" },
    take: limit,
  });

  let ran = 0;
  for (const row of due) {
    const claimed = await prisma.scheduledJob.updateMany({
      where: { id: row.id, status: "PENDING" },
      data: { status: "RUNNING" },
    });
    if (claimed.count !== 1) continue;

    try {
      const { runDmJob } = await import("@/lib/queue/dm-worker");
      await runDmJob(row.name, row.payload as unknown as DmQueueJob);
      await prisma.scheduledJob.update({
        where: { id: row.id },
        data: { status: "DONE", lastError: null },
      });
      ran += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Job failed";
      await prisma.scheduledJob.update({
        where: { id: row.id },
        data: {
          status: "PENDING",
          lastError: message.slice(0, 500),
          runAt: new Date(Date.now() + 5 * 60_000),
        },
      });
    }
  }

  return ran;
}
