import { NextRequest, NextResponse } from "next/server";
import { drainScheduledJobs } from "@/lib/queue/dispatch";
import { reconcileComments } from "@/lib/polling/comment-reconciler";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET;

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const drained = await drainScheduledJobs(20);
  await reconcileComments();

  return NextResponse.json({ success: true, drained });
}
