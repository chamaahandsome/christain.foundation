#!/usr/bin/env node
/**
 * Trickl webhook smoke test (ported from Maltivas, adapted to CF's scheme).
 *
 * Fires signed payloads at /api/webhook/trickl exactly the way Trickl would,
 * validating the transport layers BEFORE real money flows: signature
 * verification, provider resolution, exactly-once dedup, event routing, and
 * (with real IDs) ebook fulfillment.
 *
 * CF's scheme (lib/trickl.ts verifyTricklSignature):
 *   HMAC_SHA256( channelSecret, rawBody ) → hex
 *   headers: X-Trickl-Signature, X-Trickl-Webhook-Id
 *   provider resolution: data.providerLinkCode → Channel.tricklProviderLinkCode,
 *   or data.metadata.cfChannelId → Channel.id. Either way the channel row must
 *   hold tricklWebhookSecret — use a dev channel registered for Trickl.
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
  "http://localhost:3000/api/webhook/trickl";
const SECRET = flags.secret ?? process.env.TRICKL_WEBHOOK_SECRET;
const CHANNEL_ID = flags.channelId;
const LINK_CODE = flags.linkCode;
const MODE = positionals[0] ?? "suite"; // suite | fulfill

if (!SECRET || (!CHANNEL_ID && !LINK_CODE)) {
  console.error(
    "✖ Need --secret plus --channelId or --linkCode (a dev channel registered for Trickl).",
  );
  process.exit(1);
}

const runId = crypto.randomUUID().slice(0, 8);

function buildPayload({ metadata = {}, amount, eventNo }) {
  return {
    id: `evt_smoke_${runId}_${eventNo}`,
    type: "goal.completed",
    data: {
      ...(LINK_CODE ? { providerLinkCode: LINK_CODE } : {}),
      goalId: `goal_smoke_${runId}_${eventNo}`,
      ...(amount !== undefined ? { amount } : {}),
      metadata: {
        ...(CHANNEL_ID ? { cfChannelId: CHANNEL_ID } : {}),
        ...metadata,
      },
    },
  };
}

async function fire({ payload, badSig = false, webhookId, label, expect }) {
  const rawBody = JSON.stringify(payload);
  const signature = badSig
    ? "deadbeef".repeat(8)
    : crypto.createHmac("sha256", SECRET).update(rawBody).digest("hex");

  const res = await fetch(URL_, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-trickl-signature": signature,
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

if (MODE === "fulfill") await fulfill();
else await suite();
