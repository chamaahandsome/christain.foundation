import { NextResponse } from "next/server";
import { retryFailedForwards } from "@/lib/trickl-distribution";

// Trickl distribution reconcile: chunks land in CF's partner Stripe balance
// before they're available to transfer, so a forward attempted the moment
// the webhook arrives can fail on balance timing. This cron retries every
// FORWARD_FAILED chunk; anything still failing after settlement (a creator
// whose payouts got disabled, say) keeps surfacing here with its lastError.

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { retried, forwarded } = await retryFailedForwards();
  if (retried > 0) {
    console.log(`reconcile-trickl: ${forwarded}/${retried} failed forwards recovered`);
  }
  return NextResponse.json({ retried, forwarded });
}
