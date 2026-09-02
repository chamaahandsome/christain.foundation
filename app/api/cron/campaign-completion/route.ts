import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// End-of-campaign status flip (ported from Maltivas' direct-support model).
// Pledges were routed to the creator at payment time, so there is nothing
// to settle — a past-end-date campaign just becomes FUNDED (goal met) or
// COMPLETED (ran its course; the money already raised stays raised).

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ended = await db.campaign.findMany({
    where: { status: { in: ["LIVE", "FUNDED"] }, endsAt: { lte: new Date() } },
    select: { id: true, status: true, raisedCents: true, goalCents: true },
  });

  let flipped = 0;
  for (const c of ended) {
    const final = c.raisedCents >= c.goalCents ? "FUNDED" : "COMPLETED";
    if (c.status === final && final === "FUNDED") {
      // FUNDED already and past end date → it's done; mark COMPLETED? No —
      // FUNDED is a terminal success state; leave it.
      continue;
    }
    await db.campaign.update({ where: { id: c.id }, data: { status: final } });
    flipped += 1;
  }
  if (flipped > 0) console.log(`campaign-completion: flipped ${flipped} campaigns`);
  return NextResponse.json({ checked: ended.length, flipped });
}
