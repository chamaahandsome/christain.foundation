import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";

// Clerk user provisioning (ported pattern from Maltivas clerk-user-created,
// with the signature verification the original skipped). Keeps the local
// User row in sync so applications, vouches, and team invitations can bind
// to it. Requires CLERK_WEBHOOK_SIGNING_SECRET.

export async function POST(req: NextRequest) {
  let evt;
  try {
    evt = await verifyWebhook(req);
  } catch (err) {
    console.error("clerk webhook verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (evt.type !== "user.created" && evt.type !== "user.updated") {
    return NextResponse.json({ received: true });
  }

  const data = evt.data;
  const primaryEmail =
    data.email_addresses?.find((e) => e.id === data.primary_email_address_id)
      ?.email_address ?? data.email_addresses?.[0]?.email_address;
  if (!primaryEmail) {
    // A user without an email can't hold applications or invitations yet.
    return NextResponse.json({ received: true, skipped: "no email" });
  }

  const name =
    [data.first_name, data.last_name].filter(Boolean).join(" ") || null;

  await db.user.upsert({
    where: { id: data.id },
    create: {
      id: data.id,
      email: primaryEmail,
      name,
      imageUrl: data.image_url ?? null,
    },
    update: {
      email: primaryEmail,
      name,
      imageUrl: data.image_url ?? null,
    },
  });

  return NextResponse.json({ received: true });
}
