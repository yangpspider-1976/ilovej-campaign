# iLoveJ — Comment-to-DM Voucher Campaign

Backend + admin for iLoveJ's Meta **comment-to-DM** promo. A user comments on an
ad, receives a DM with a link to the Shopify promos page, enters their mobile
number, is assigned a tiered discount voucher (30%–90% off) from limited
inventory, and receives the code by **SMS**.

- **Frontend:** the live Shopify page at `https://ilovej.store/pages/promos`
  (a self-contained theme section — see [`scripts/ilovej-voucher-form.liquid`](scripts/ilovej-voucher-form.liquid)).
- **This repo:** the Next.js **API + admin dashboard** that the Shopify form
  calls. It is the backend only; it holds the SMS credentials, owns the voucher
  inventory, and persists every lead/claim.

> Why a separate backend + DB? Secret SMS credentials can't live in the
> browser, and atomic voucher assignment (one code per number, limited tiered
> stock) needs a real database — neither of which a Shopify page provides.

## Tech stack

- **Next.js 16** (App Router, Turbopack) + **React 19**
- **Turso / libSQL** (`@libsql/client`) — async, SQLite-compatible, works on
  serverless. Local dev uses a `file:` DB; production uses Turso cloud.
- **Tailwind CSS v4**
- **Movider** SMS gateway (Philippines); provider-agnostic sender also supports
  Twilio / Infobip / ClickSend via `SMS_PROVIDER`.
- Deployed on **Vercel**.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). On the first request the
database schema is created and **1,000 vouchers are seeded automatically**
(30%×600, 40%×250, 50%×100, 70%×40, 90%×10) for campaign `ilovej_meta_test`.

### Environment variables

Create `.env.local` (not committed):

```bash
# Database — local dev uses a file; production uses Turso cloud
TURSO_DATABASE_URL=file:./data/campaign.db
TURSO_AUTH_TOKEN=

# SMS (Movider)
SMS_PROVIDER=movider
SMS_API_KEY=...
SMS_API_SECRET=...
SMS_SENDER_ID=iLoveJ
# Set to true ONLY on a Movider trial account (forces the default sender +
# stability-check message so delivery can be tested). Remove for real vouchers.
# MOVIDER_TRIAL_MODE=true

# Shopify
SHOPIFY_STORE_URL=https://ilovej.store
NEXT_PUBLIC_SHOPIFY_STORE_URL=https://ilovej.store
SHOPIFY_WEBHOOK_SECRET=...

# CORS — origins allowed to call the claim API
ALLOWED_ORIGINS=https://ilovej.store

# Admin dashboard / resend endpoint
ADMIN_SECRET=...
```

In production these are set in the Vercel dashboard, with `TURSO_DATABASE_URL`
pointing at the Turso cloud database (`libsql://…`) and `TURSO_AUTH_TOKEN` set.

## API routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/voucher/claim` | POST | Validate phone, create lead, assign a voucher, send SMS. CORS-enabled for the Shopify origin; rate-limited per IP. |
| `/api/voucher/status` | GET | Look up a voucher by phone number. |
| `/api/sms/send` | POST | Admin resend of a voucher SMS for an existing lead (requires `x-admin-secret`). |
| `/api/shopify/order-webhook` | POST | Marks a voucher used when its code is redeemed in an order (HMAC-verified). |
| `/api/admin/campaign-summary` | GET | Campaign + tier counts (requires `x-admin-secret`). |
| `/api/admin/leads` | GET | Lead list (requires `x-admin-secret`). |
| `/api/admin/vouchers` | GET | Voucher inventory (requires `x-admin-secret`). |

## Pages

- `/admin`, `/admin/leads`, `/admin/vouchers` — admin dashboard (async Server Components).
- `/voucher/ilovej`, `/success`, `/already-claimed` — fallback claim flow (the
  Shopify page is the primary frontend).

## Shopify integration

The promos page form is the custom section
[`scripts/ilovej-voucher-form.liquid`](scripts/ilovej-voucher-form.liquid),
added to `templates/page.promos.json` via the Shopify **Theme Customizer**. It
is fully self-contained (no external CDN/fonts), posts directly to
`/api/voucher/claim`, and shows an inline success screen. It replaced the
Shopify Forms app block, whose own JavaScript could not be intercepted.

## Deployment

1. Push to `main` — Vercel auto-deploys.
2. Set all env vars in the Vercel dashboard; create a Turso cloud DB and point
   `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` at it.
3. To reset inventory, drop the tables in the Turso console
   (`campaigns`, `leads`, `vouchers`, `sms_logs`, `events`) — they are recreated
   and re-seeded on the next request.

## Database

`src/lib/db.ts` is the async libSQL layer (schema init, idempotent self-healing
seed, and all queries). Tables: `campaigns`, `leads`, `vouchers`, `sms_logs`,
`events`.
