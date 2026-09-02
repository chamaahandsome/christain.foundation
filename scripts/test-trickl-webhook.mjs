#!/usr/bin/env node
/**
 * Trickl webhook smoke test (ported from Maltivas, adapted to CF's scheme).
 *
 * Fires signed payloads at /api/webhook/trickl exactly the way Trickl would,
 * validating the transport layers BEFORE real money flows: signature
 * verification, provider resolution, exactly-once dedup, event routing, and
 * (with real IDs) ebook fulfillment.
 *
 * CF's scheme (lib/trickl.ts verifyTricklSignature — matches the Trickl
 * backend's webhookService):
 *   HMAC_SHA256( channelSecret, `${timestamp}.${rawBody}` ) → hex
 *   headers: X-Trickl-Signature, X-Trickl-Timestamp (unix seconds, 5-min
 *   replay window), X-Trickl-Webhook-Id
 *   provider resolution: data.metadata.cfChannelId → Channel.id; the channel
 *   row must hold tricklWebhookSecret — use a dev channel registered for
 *   Trickl. Amounts in payload.data are DOLLARS (metadata.cfAmountCents is
 *   the authoritative cents figure CF stamps at goal creation).
 *
 * ── Usage ──────────────────────────────────────────────────────────────────
 *   # Full self-checking suite against a local dev server:
 *   node scripts/test-trickl-webhook.mjs --secret whsec_xxx --channelId ch_xxx
 *
 *   # Same via link code, against a deployed URL:
 *   node scripts/test-trickl-webhook.mjs --secret whsec_xxx --linkCode lk_xxx \
 *     --url https://preview.example.com/api/webhook/trickl
 *
 *   # End-to-end ebook fulfillment (grants the purchase — real IDs required):
 *   node scripts/test-trickl-webhook.mjs fulfill --secret whsec_xxx \
 *     --channelId ch_xxx --ebookId eb_xxx --userId user_xxx --amount 1200
 *
 *   # End-to-end gift (cup of cold water) — one-time then a recurring cycle:
 *   node scripts/test-trickl-webhook.mjs tip --secret whsec_xxx \
 *     --channelId ch_xxx --userId user_xxx --amount 500
 *
 *   # Chunk distribution: a round-up chunk lands in CF's balance and CF
 *   # forwards net-of-fee to the creator; then Trickl claws it back:
 *   node scripts/test-trickl-webhook.mjs chunk --secret whsec_xxx \
 *     --channelId ch_xxx --amount 300
 *
 * Without real ebook/user IDs the handler safely acknowledges with a log line
 * and still returns 200 — enough to validate signature/dedup/routing.
 */

import crypto from "node:crypto";

// ── Args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const positionals = [];
const flags = {};
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith("--")) flags[argv[i].slice(2)] = argv[++i];
  else positionals.push(argv[i]);
}

const URL_ =
  flags.url ??
  process.env.TRICKL_WEBHOOK_URL ??
  "http://localhost:3001/api/webhook/trickl";
const SECRET = flags.secret ?? process.env.TRICKL_WEBHOOK_SECRET;
const CHANNEL_ID = flags.channelId;
const LINK_CODE = flags.linkCode;
const MODE = positionals[0] ?? "suite"; // suite | fulfill | tip | chunk

if (!SECRET || (!CHANNEL_ID && !LINK_CODE)) {
  console.error(
    "✖ Need --secret plus --channelId or --linkCode (a dev channel registered for Trickl).",
  );
  process.exit(1);
}

const runId = crypto.randomUUID().slice(0, 8);

function buildPayload({ metadata = {}, amount, eventNo, type = "goal.completed", data = {} }) {
  return {
    id: `evt_smoke_${runId}_${eventNo}`,
    type,
    data: {
      ...(LINK_CODE ? { providerLinkCode: LINK_CODE } : {}),
      goalId: `goal_smoke_${runId}_${eventNo}`,
      ...(amount !== undefined ? { amount } : {}),
      metadata: {
        ...(CHANNEL_ID ? { cfChannelId: CHANNEL_ID } : {}),
        ...metadata,
      },
      ...data,
    },
  };
}

async function fire({ payload, badSig = false, staleTs = false, webhookId, label, expect }) {
  const rawBody = JSON.stringify(payload);
  const timestamp = String(
    Math.floor(Date.now() / 1000) - (staleTs ? 600 : 0),
  );
  const signature = badSig
    ? "deadbeef".repeat(8)
    : crypto
        .createHmac("sha256", SECRET)
        .update(`${timestamp}.${rawBody}`)
        .digest("hex");

  const res = await fetch(URL_, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-trickl-signature": signature,
      "x-trickl-timestamp": timestamp,
      ...(webhookId ? { "x-trickl-webhook-id": webhookId } : {}),
    },
    body: rawBody,
  });
  const body = await res.json().catch(() => ({}));
  const ok = expect(res.status, body);
  console.log(
    `${ok ? "✅" : "❌"} ${label} → ${res.status} ${JSON.stringify(body)}`,
  );
  return ok;
}

// ── Suites ──────────────────────────────────────────────────────────────────
async function suite() {
  console.log(`Trickl webhook smoke suite → ${URL_} (run ${runId})\n`);
  const results = [];

  results.push(
    await fire({
      label: "valid event acknowledged",
      payload: buildPayload({ eventNo: 1 }),
      webhookId: `wh_smoke_${runId}_1`,
      expect: (s, b) => s === 200 && b.received === true && !b.duplicate,
    }),
  );

  results.push(
    await fire({
      label: "duplicate webhook id → dedup",
      payload: buildPayload({ eventNo: 1 }),
      webhookId: `wh_smoke_${runId}_1`, // same delivery id as above
      expect: (s, b) => s === 200 && b.duplicate === true,
    }),
  );

  results.push(
    await fire({
      label: "tampered signature rejected",
      payload: buildPayload({ eventNo: 2 }),
      webhookId: `wh_smoke_${runId}_2`,
      badSig: true,
      expect: (s) => s === 401,
    }),
  );

  results.push(
    await fire({
      label: "unknown provider rejected",
      payload: {
        id: `evt_smoke_${runId}_3`,
        type: "goal.completed",
        data: { goalId: "goal_x", metadata: {} }, // no linkCode, no cfChannelId
      },
      webhookId: `wh_smoke_${runId}_3`,
      expect: (s) => s === 400,
    }),
  );

  results.push(
    await fire({
      label: "stale timestamp rejected (replay window)",
      payload: buildPayload({ eventNo: 5 }),
      webhookId: `wh_smoke_${runId}_5`,
      staleTs: true,
      expect: (s) => s === 401,
    }),
  );

  results.push(
    await fire({
      label: "missing event id rejected",
      payload: { ...buildPayload({ eventNo: 4 }), id: undefined },
      // no x-trickl-webhook-id header and no payload id
      expect: (s) => s === 400,
    }),
  );

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exit(passed === results.length ? 0 : 1);
}

async function fulfill() {
  const { ebookId, userId } = flags;
  if (!ebookId || !userId) {
    console.error("✖ fulfill mode needs --ebookId and --userId (real rows).");
    process.exit(1);
  }
  const amount = flags.amount ? Number(flags.amount) : undefined;
  console.log(`Trickl ebook fulfillment → ${URL_} (run ${runId})\n`);
  const ok = await fire({
    label: `grant ebook ${ebookId} to ${userId}`,
    payload: buildPayload({
      eventNo: "fulfill",
      amount,
      metadata: { cfKind: "ebook", cfEbookId: ebookId, cfUserId: userId },
    }),
    webhookId: `wh_smoke_${runId}_fulfill`,
    expect: (s, b) => s === 200 && b.received === true,
  });
  console.log(
    "\nNow verify: EbookPurchase row exists, Transaction ledger row written,",
    "\nbuyer notification created, and /books shows the grant for that user.",
  );
  process.exit(ok ? 0 : 1);
}

async function tip() {
  const { userId } = flags;
  if (!userId) {
    console.error("✖ tip mode needs --userId (a real User row).");
    process.exit(1);
  }
  const amountCents = flags.amount ? Number(flags.amount) : 500;
  console.log(`Trickl gift fulfillment → ${URL_} (run ${runId})\n`);
  const results = [];
  results.push(
    await fire({
      label: `one-time cup $${(amountCents / 100).toFixed(2)} (goal.completed)`,
      payload: buildPayload({
        eventNo: "tip1",
        data: { targetAmount: amountCents / 100 }, // Trickl reports dollars
        metadata: {
          cfKind: "tip",
          cfUserId: userId,
          cfAmountCents: String(amountCents),
          cfNote: "Smoke-test cup — keep going!",
        },
      }),
      webhookId: `wh_smoke_${runId}_tip1`,
      expect: (s, b) => s === 200 && b.received === true,
    }),
  );
  results.push(
    await fire({
      label: "recurring cup cycle 2 (goal.cycle_paid)",
      payload: buildPayload({
        eventNo: "tip2",
        type: "goal.cycle_paid",
        amount: amountCents / 100, // dollars
        data: { cycleNumber: 2 },
        metadata: {
          cfKind: "tip",
          cfUserId: userId,
          cfAmountCents: String(amountCents),
        },
      }),
      webhookId: `wh_smoke_${runId}_tip2`,
      expect: (s, b) => s === 200 && b.received === true,
    }),
  );
  console.log(
    "\nNow verify: two GIFT Transaction rows (feeCents 0, provider trickl),",
    "\nand two 💧 notifications for the channel owner.",
  );
  process.exit(results.every(Boolean) ? 0 : 1);
}

async function chunk() {
  const amountCents = flags.amount ? Number(flags.amount) : 300;
  console.log(`Trickl chunk distribution → ${URL_} (run ${runId})\n`);
  const chunkId = `chunk_smoke_${runId}`;
  const results = [];
  results.push(
    await fire({
      label: `round-up chunk $${(amountCents / 100).toFixed(2)} lands → forward attempted`,
      payload: buildPayload({
        eventNo: "chunk1",
        type: "goal.round_up_collected",
        amount: amountCents / 100, // dollars
        data: { chunkId },
        metadata: { cfKind: "tip" },
      }),
      webhookId: `wh_smoke_${runId}_chunk1`,
      expect: (s, b) => s === 200 && b.received === true,
    }),
  );
  results.push(
    await fire({
      label: "redelivery of same chunk → no double forward",
      payload: buildPayload({
        eventNo: "chunk1b",
        type: "goal.round_up_collected",
        amount: amountCents / 100,
        data: { chunkId }, // same chunkId, new webhook id
        metadata: { cfKind: "tip" },
      }),
      webhookId: `wh_smoke_${runId}_chunk1b`,
      expect: (s, b) => s === 200 && b.received === true,
    }),
  );
  results.push(
    await fire({
      label: "reversal claws the chunk back",
      payload: buildPayload({
        eventNo: "chunk2",
        type: "goal.payment_failed",
        data: { chunkId, reversal: true, reversalReason: "ach_return" },
        metadata: { cfKind: "tip" },
      }),
      webhookId: `wh_smoke_${runId}_chunk2`,
      expect: (s, b) => s === 200 && b.received === true,
    }),
  );
  console.log(
    "\nNow verify: ONE TricklChunk row for the chunkId (fee split 5%),",
    "\nstatus REVERSED at the end (FORWARDED in between if Stripe balance allowed).",
  );
  process.exit(results.every(Boolean) ? 0 : 1);
}

if (MODE === "fulfill") await fulfill();
else if (MODE === "tip") await tip();
else if (MODE === "chunk") await chunk();
else await suite();
