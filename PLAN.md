# Christian Foundation (CF) — Engineering Plan

**Tagline:** *In essentials, UNITY. In non-essentials, liberty. In all things, charity.* — Rupertus Meldenius

**Companion to the concept note (v3, 2026-08-08).** The concept note is the product authority; this file translates it into architecture, data model, and build order. Where the two disagree, the concept note wins.

---

## 1. What changed from the v1 plan

The original plan was "YouTube meets Maltivas" — a hosted-video platform with a commerce layer. The concept has since pivoted on three axes, and this plan reflects them:

1. **Embedded, not hosted.** The free library is embedded YouTube content — indexed, tagged, and placed inside the doctrinal map. CF hosts natively (Mux) only content with revenue attached: premieres, ticketed films, courses, member content. This eliminates the free-video cost problem and most music-licensing exposure (embedded playback keeps licensing and Content ID on YouTube's side).
2. **The doctrinal map is the product core.** Spine (essentials, one confident answer) + map (disputed questions, strongest representative of each view, side by side, origins included). *Start Here* pathway for new converts. This is net-new engineering with no Maltivas analogue.
3. **Giving is legally constrained by design.** Concept §9 rules are hard constraints: CF never merchant of record on gifts, never issues receipts, Mode A (agency of record) / Mode B (direct, non-deductible) is the central branch. Trickl is commerce-only.

---

## 2. Architecture: two content layers

### Layer 1 — Embedded discovery (free, near-zero delivery cost)
- `ContentItem.source = EMBEDDED_YOUTUBE`: stores YouTube video ID + CF's own metadata (topics, doctrinal-map position, series, scripture refs, transcript-derived search text).
- Playback via the official YouTube iframe player inside a CF watch surface: our chrome, our related-content rail, our next-up (`rel=0`; note YouTube still shows same-channel end-screen suggestions — we control around the player, not inside it).
- Ingestion: creator connects channel → we pull their library via YouTube Data API → bulk-tag/organize (editorial tooling for the founding-cohort indexing work).
- Track playback events via the iframe API for continue-watching and analytics.
- Respect embed rules: official player only, no download/proxy of streams, embeds-enabled videos only.

### Layer 2 — Native hosting (revenue-attached)
- `ContentItem.source = NATIVE_MUX`: the ported Maltivas pipeline (direct upload → webhook → playback) for premieres, ticketed films, courses, member content. DRM/offline later.
- Publications & datasets (researcher channels): S3-backed documents (papers, preprints, excavation reports, data files) — a third, non-AV content shape.

### Audio-first
- Default playback mode is audio where available; video one tap away.
- Native audio: cheap Mux audio-only assets (or S3+HLS). Embedded YouTube cannot be audio-stripped (ToS) — audio-first applies to native and podcast content; embedded teaching plays as normal video.
- Podcasts: RSS in (index existing shows) and RSS out (creators keep Apple/Spotify).

---

## 3. The doctrinal map & Start Here (product core)

```
Topic          — hierarchical taxonomy (Gospel, Scripture, Prayer, Apologetics, …)
Question       — a mapped question; tier: SPINE | DISPUTED; plain-language framing
                 of what's at stake; DISPUTED lists its Positions
Position       — a view on a DISPUTED question (e.g. credobaptism); holds the
                 strongest representative content for that view
ContentItem ↔ Question/Position/Topic — many-to-many placement, editorially curated
Pathway        — Start Here: ordered steps through SPINE content for new believers
PathwayStep    — step + completion tracking per user
```

- Spine questions render one curated path, no both-sides framing. Disputed questions render positions side by side. Origins is a DISPUTED question by decree (concept §4).
- Editorial tooling (admin): map management, content placement, representative selection. This tooling is a Phase 1 deliverable, not an afterthought — the founding-cohort indexing work happens in it.
- Full-text topical search across CF metadata + transcripts (Prisma fullTextSearch; pull YouTube captions where available for search text).

---

## 4. Creator gate & audit machinery

- **Application**: affirmation of the published doctrinal statement (concept §5.1–5.2) — recorded per-clause with timestamp and statement version; conduct agreement (§5.3); vouching (port Maltivas `Vouch` + invite/approval flow).
- **Standing audit (§5.4)**: report flow + review queue on *published teaching*, with case tracking (claim, content cited, reviewer, outcome, appeal). The moderation queue and the doctrinal audit share infrastructure but are distinct queues — safety/abuse vs. doctrine.
- **Statement versioning**: the doctrinal statement is published and versioned; re-affirmation required on material change.

**Status (2026-08-16):** application/affirmation/submit/admin-queue shipped earlier; this milestone added the ported machinery — invite codes (`InviteCode` model, `/admin/invites`, redemption in the apply flow; a redeemed code bypasses the vouch minimum per-application, `FOUNDING_COHORT_MODE` kept as blanket fallback), voucher-facing surface (`/vouch/[applicationId]` share link + `VOUCH_RECEIVED` notification), team access (`TeamMember` model with per-feature JSON access `library|team|analytics|settings` × `none|viewer|manager`, `lib/team.ts` pure rules + `lib/team-authorization.ts` server checks, `/studio/team/[channelId]` roster, `/team/accept/[token]` — invite links are addressed: accepting requires signing in with the invited email; mutations owner-only, as Maltivas' `assertOwnership`), and the Clerk user-provisioning webhook (`/api/webhook/clerk`, svix-verified via `CLERK_WEBHOOK_SIGNING_SECRET` — Maltivas' original skipped verification). Team invites have no transactional email yet (SES lands with the newsletter port) — owners copy the accept link. Deliberately not ported: the HMAC approval-cookie (`creator-approval-token`) — CF's `/studio` must stay reachable by applicants to show application status, and per-route DB checks are the enforcement anyway; revisit if middleware-level approval gating becomes necessary. Maltivas' vouch machinery was found inert (nothing gates on `vouchCount`) — CF's gate logic is net-new by design.

**Standing audit shipped 2026-08-16:** §5.4 is now built — report flow on watch pages (signed-in, concrete claim with a 30-char floor, one open case per reporter per item, `lib/doctrine.ts` state machine tested), admin queue at `/admin/doctrine` (start review / uphold / dismiss, outcome note required, decisions notify the channel owner), and appeal (channel owner only, UPHELD cases only — dismissal already favors the channel; appeal returns the case to the queue with the appeal note attached). Remaining §4 gap: ~~a re-affirmation prompt for existing creators when a new statement version publishes~~ — closed 2026-08-16: `/studio/affirm` re-signs the current version per clause (new clauses highlighted, all-or-nothing), with a studio banner whenever an approved creator's signature trails the published statement.

**Studio suite shipped 2026-08-16 (creator features beyond the gate):** channel settings (`/studio/settings/[channelId]` — name, bio, https-only fixed-key links rendered on the public channel page, YouTube link with uniqueness conflict handling; gated settings:manager), library management (`/studio/library/[channelId]` — rename, visibility, series create/assign/delete-empty; gated library, edits manager-only), and analytics v1 (`/studio/analytics/[channelId]` — followers + 30d growth, watches/completions/rate, likes, comments, top-10 most-watched; gated analytics:viewer; embedded-playback floor, revenue/lapse signals arrive with commerce phases).

---

## 5. Tech stack

Unchanged from Maltivas where ported; deltas in bold.

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript — start on Next 15 / React 19 |
| DB | MySQL + Prisma (`relationMode = "prisma"`), fresh schema |
| Auth | Clerk + ported team-access system (ministry staff manage a teacher's channel) |
| **Discovery video** | **YouTube iframe player + YouTube Data API (library ingestion, metadata, captions)** |
| Revenue video/audio | Mux (ported upload→webhook→player pipeline); audio-only assets for native audio |
| Payments | Stripe Connect (+ ported payout policy for commerce), Paystack (KE), Trickl (commerce only) |
| Storage | S3 (+ documents/datasets for researcher channels) |
| Email | AWS SES + Unlayer newsletter editor, ZeroBounce |
| Realtime | Pusher (comments, communities) |
| Queue/cache | Redis + BullMQ (also seat holds) |
| UI | Tailwind + shadcn/Radix only (no MUI second stack) |
| i18n | next-intl (en first; es/fr/pt when content warrants) |
| Hosting | Vercel + crons (payout-release, reconcile-trickl, expire-reservations, …) |

---

## 6. Data model sketch (v1)

### Content & map (new)
```
Channel        — handle, name, kind (TEACHER|PASTOR|MISSIONARY|MUSICIAN|FILMMAKER|
                 AUTHOR|PODCASTER|ORGANIZER|RESEARCHER|ARCHAEOLOGIST|MINISTRY),
                 bio, links, youtubeChannelId?, gate status (affirmation record,
                 vouches, approval), missionary/researcher extensions
ContentItem    — source (EMBEDDED_YOUTUBE|NATIVE_MUX|DOCUMENT), kind (VIDEO|SERMON|
                 MUSIC|PODCAST|FILM|PAPER|DATASET), youtubeVideoId?/muxAssetId?/fileKey?,
                 audioOnly, duration, visibility (PUBLIC|MEMBERS|PAID),
                 topics[], scriptureRefs[], seriesId?, transcript/search text
Series / Playlist / Follow / WatchProgress / Like / Comment (moderation status)
Topic / Question / Position / Pathway / PathwayStep  (see §3)
Community / CommunityPost (DISCUSSION|PRAYER_REQUEST|ANNOUNCEMENT)
Shelf          — editorial rows for home/explore surfaces
AffirmationRecord — creator × statement version × clause, timestamped
DoctrineReviewCase — §5.4 audit: content cited, claim, reviewer, outcome, appeal
```

### Giving (concept §9 — constraints, not preferences)
```
SupportPlan    — recurring/one-time partner giving to a channel
recipient_type — agency_affiliated | independent  (the central branch)
SendingOrg     — legal name, EIN, verified 501(c)(3) status + verification date
receipt_responsibility — agency | none   (never cf; no receipt codepath exists)
deductibility_disclosed_at — per transaction; renewals store disclosure state
ModeChangeNotice — partner notification before next charge when mode changes
Payout eligibility + KYC/OFAC screening state on Channel (checked at onboarding)
```
Implementation: partner gifts use Stripe **direct charges on the connected account** (recipient is merchant of record; CF fee via application_fee) — NOT the Maltivas platform-charge/payout-hold model, which applies to commerce only.

### Crowdfunding (concept §7b — four categories)
```
Campaign.category — MISSION | CREATIVE | RESEARCH | NEED
MISSION   — inherits §9 rules in full (Mode A/B by recipient of record)
CREATIVE  — CF-vetted creator, stated deliverable + timeline
RESEARCH  — qualification record: credentials, affiliation, track record,
            protocol (incl. what counts as a negative result), budget/timeline,
            peer-review where applicable; ReportingCommitment + BackerReport
            (progress, interim findings, negative results) are first-class
NEED      — voucher (CF creator or church), strictest fraud review, Mode B
            disclosure verbatim; ships last
+ ported CampaignReward/Pledge/Update models (minus DAO fields)
```
Research campaigns inherit the Mode A/B branch too (university/foundation = Mode A-shaped; independent = Mode B). Archaeology: season = campaign unit (one campaign → season footage → report → ticketed site tours).

### Commerce & events (ported/adapted)
```
Product/Variant/Order/ShippingAddress/RegionalPrice · EBook* (reader + anti-piracy)
Booking/Availability · Email/Subscriber* (newsletters) · Transaction/PayoutLeg/
PayoutRequest/CreatorBalance · TricklPayment · ProcessedWebhookEvent · Notification
Event (CONCERT|CONFERENCE|WORKSHOP|BOOTCAMP|REVIVAL|MEETUP|DEBATE|SITE_TOUR)
TicketTier / Ticket (QR, seatId?) / EventSession
SeatMap/Section/Row/Seat — template-grid charts v1; Redis TTL holds via ported
atomic-claim; unique (eventId, seatId); Seats.io only if arena-scale arrives
FilmAccess — FREE|PAID|TICKET_ONLY, FilmPurchase, Premiere
```

**Trickl surface (hard rule):** tickets, books/ebooks, merch, paid films — commerce only. Never on SupportPlan or MISSION/NEED campaigns. CREATIVE-with-rewards is an open question for counsel (reward = commerce?) — default OFF until answered.

**Trickl donations update (2026-08-16, from the Trickl repo):** Trickl has since shipped a verified-nonprofit donation product — providers can register as 501(c)(3) (Stripe `business_type: non_profit`, verification status tracked), Trickl issues donation tax receipts *for the verified NGO provider* per charge, supports recurring donation subscriptions and donor fee coverage. §9 analysis: the provider's own Stripe account receives funds (recipient is merchant of record, never CF) and receipts come from the NGO side (never CF) — so Trickl-for-giving is §9-compatible in the Mode-A shape (verified sending org as provider) and possible for Mode B with CF's non-deductible disclosure (isNonprofit=false → Trickl issues no receipts). This widens the phase-7 design space; the commerce-only rule stands until the concept note is amended and counsel confirms. Commerce integration shipped: provider registration rides the channel's Stripe Connect account (Payments tab), per-provider HMAC webhook at `/api/webhook/trickl`, amount rules ported (min $3 chunk, ~$40/45-day window scaling, 180-day clamp, deposit offsets).

---

## 7. Port map from Maltivas (`themaltivas-v2`)

| Concern | Files |
|---|---|
| Payments core | `lib/stripe.ts`, `lib/platform-fees.ts`, `lib/payments/*` (commerce flows), `app/api/webhook/route.ts` |
| Trickl | `lib/trickl*.ts`, `app/api/webhook/trickl/`, `app/api/cron/reconcile-trickl/`, `components/trickl/*` |
| Paystack | `lib/paystack*.ts`, `lib/payment-countries.ts`, webhook |
| Pricing/geo | `lib/regional-pricing.ts`, `lib/region-visibility.ts`, `lib/currency-conversion.ts`, `lib/geolocation.ts` |
| Video (native) | screening-room upload/webhook routes (pattern), `components/sections/MuxPlayer.tsx` |
| Auth | `middleware.ts` (pattern), `lib/auth-helpers.ts`, `lib/team-authorization.ts`, `lib/api-middleware.ts`, `lib/creator-approval-token.ts`, clerk-user-created webhook |
| Vetting | `Vouch`, invite-code + approval flow, organizer-review pattern |
| Ebooks | reader components, paywall + anti-piracy routes |
| Newsletters | `lib/email.sender.ts`, `lib/email-templates/`, Unlayer editor components |
| Crowdfunding | campaign models/routes/components minus governance |
| Events/ticketing | Convention-stack subset: tiers, orders, QR + `TicketVerificationHistory`, Trickl tickets |
| Films | `FilmPurchase`/access routes, `Premiere` |
| Infra | `lib/db.ts`, `lib/redis.ts`, `lib/queue/*`, `lib/pusher.ts`, `lib/security/*`, `lib/webhook-security.ts` |

Not ported: conventions/festivals full stacks, awards, Do-Biz, comics, Tolkoin, DAO, AI studio, Rapyd/Flutterwave/Dwolla/Plaid, MUI.

---

## 8. Cross-cutting v1 essentials

- **Notifications** (email + web push): new content, community activity, backer reports, partner notices. The follow loop is dead without them.
- **Creator analytics**: embedded playback (iframe API events) + native metrics + follower growth + revenue + **partner lapse-risk signals** (concept §9.7 — retention is the product).
- **Library indexing tooling**: the founding-cohort onboarding is an editorial job — bulk YouTube import, tagging, map placement. Build the tool, not a spreadsheet.
- **Sharing/SEO**: watch/question/pathway pages with OG cards + sitemaps; the doctrinal map is highly linkable ("what's at stake in the baptism question" is a shareable page).
- **Admin**: creator gate queue, doctrine review queue (§5.4), moderation queue, campaign qualification review (esp. RESEARCH/NEED), refunds.
- **Legal docs**: ToS, community guidelines, privacy/GDPR, DMCA (registered agent — still required for native uploads and community content), published doctrinal statement + disputed-questions list (versioned).

---

**Cross-cutting debts cleared 2026-08-16 (§8):** editorial tooling shipped — `/admin/curation` places library teaching onto topics/questions/positions (the founding-cohort indexing tool) and `/admin/shelves` manages the explore rows; watch-page comments with post-moderation and a safety queue at `/admin/moderation` (distinct from the doctrine audit); dead-embed cron (`/api/cron/check-embeds`, daily via vercel.json, thumbnail-liveness signal — marks `ContentItem.unavailableAt`, public surfaces filter it, recovery is automatic); sitemap + robots; admin nav unified; admin checks accept `ADMIN_EMAILS` (verified addresses) alongside `ADMIN_USER_IDS`. Search now indexes creator tags (`searchText`); **true transcript search still needs owner-OAuth captions.download** — revisit when creators connect Google (the verification flow already establishes that connection).

**Ebooks shipped 2026-08-26 (first purchasable, phase 6):** chapter HTML in the database (the Maltivas model — no file to pirate), studio Books tab (create/price/publish, chapter editor, free previews; paid publishing gated on Stripe payouts per §9.4), public `/book/[id]` with locked chapter list, checkout via Stripe Checkout (destination charge + 5% application fee) or a Trickl micro-payment goal (eligibility from the window rules), webhook fulfillment writing ledger `Transaction` rows + idempotent grants + buyer notification, protected reader at `/read/[ebookId]` (server-side sanitized HTML, watermark/no-select/no-copy chrome), buyer library at `/books`, and a Books shelf on channel pages. Stripe webhook now also needs the `checkout.session.completed` event enabled.

## 9. Open questions

1. **Trickl on CREATIVE reward campaigns** — commerce or giving? Counsel decides; OFF by default.
2. **Research campaign tax treatment** — confirm Mode A handoff works for universities/foreign institutions as recipient of record.
3. **"CF funds research" wording** (concept §4) vs Rule 1 (§9) — clarify platform-as-surface vs CF-as-funder before this appears in public copy.
4. **Embed dependence** — a creator deleting/privating YouTube videos breaks library entries; need dead-link detection (cron) and a graceful degrade story. Also confirm YouTube ToS comfort re: building a curated surface on embeds (official player, no stream proxying — compliant as designed, but get it reviewed).
5. **Music licensing (native only)** — paid films/premieres with licensed music still need the uploader license affirmation; embedded content is YouTube's problem.
6. **Payout-country gaps** — verify Stripe payout eligibility for target mission fields at onboarding (concept §9.4); a channel that can't be paid must not publish a giving page.
7. **Nonprofit counsel review** — gates Phase 2b (Mode A) and NEED campaigns.

---

## 10. Build order

1. **Scaffold**: Next.js + Prisma + Clerk + shadcn; base schema (Channel, ContentItem, Series, Follow, Topic/Question/Position, Pathway); middleware; CI.
2. **Embedded library**: YouTube channel connect → ingestion → watch surface (iframe player, CF chrome) → search. Editorial tooling for map placement.
3. **The map**: Start Here pathway, question/position pages, spine/disputed rendering, shelves, home surfaces.
4. **Creator gate**: application + affirmation records + vouching + approval; team access; channel pages.
5. **Notifications + analytics + sharing/SEO.**
6. **Commerce spine**: Stripe Connect onboarding, first purchasable (ebooks), webhook/ledger, payout policy (commerce), regional pricing.
7. **Partner giving Mode B**: direct charges on connected accounts, disclosure machinery, partner updates surface, lapse signals.
8. **Events + ticketing** (incl. reserved seating), **crowdfunding** (MISSION/CREATIVE first; RESEARCH with qualification workflow; NEED last), **bookings, newsletters, Trickl, native film/premieres**.
9. **Mode A agency giving** (post-counsel), communities, live Q&A, mobile/TV.
