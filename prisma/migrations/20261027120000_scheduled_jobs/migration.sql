CREATE TABLE "ScheduledJob" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dedupeKey" TEXT,
    "payload" JSONB NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScheduledJob_dedupeKey_key" ON "ScheduledJob"("dedupeKey");
CREATE INDEX "ScheduledJob_status_runAt_idx" ON "ScheduledJob"("status", "runAt");
