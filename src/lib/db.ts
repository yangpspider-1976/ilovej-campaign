import { createClient, type Client } from "@libsql/client";
import { randomUUID } from "crypto";

// ─── Client singleton ─────────────────────────────────────────────────────────

let _client: Client | null = null;

function getDb(): Client {
  if (!_client) {
    const url = process.env.TURSO_DATABASE_URL ?? "file:./data/campaign.db";
    const authToken = process.env.TURSO_AUTH_TOKEN ?? undefined;
    _client = createClient({ url, authToken });
  }
  return _client;
}

// ─── Lazy schema init (runs once per process) ─────────────────────────────────

let _readyPromise: Promise<void> | null = null;

async function ensureReady(): Promise<void> {
  if (!_readyPromise) {
    _readyPromise = initSchema().then(seedDefaultCampaign);
  }
  return _readyPromise;
}

async function initSchema(): Promise<void> {
  await getDb().executeMultiple(`
    CREATE TABLE IF NOT EXISTS campaigns (
      campaign_id TEXT PRIMARY KEY,
      campaign_name TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      total_voucher_limit INTEGER DEFAULT 1000,
      status TEXT DEFAULT 'active',
      source_channel TEXT DEFAULT 'meta',
      ad_campaign_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS leads (
      lead_id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      name TEXT,
      phone_raw TEXT,
      phone_normalized TEXT NOT NULL,
      email TEXT,
      meta_user_id TEXT,
      source TEXT DEFAULT 'landing_page',
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      utm_content TEXT,
      utm_term TEXT,
      consent_voucher_sms INTEGER DEFAULT 0,
      consent_marketing INTEGER DEFAULT 0,
      consent_at TEXT,
      privacy_policy_version TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id),
      UNIQUE(campaign_id, phone_normalized)
    );

    CREATE TABLE IF NOT EXISTS vouchers (
      voucher_id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      lead_id TEXT,
      discount_tier INTEGER NOT NULL,
      -- NOT unique: codes are shared per tier (every 30% winner gets ILJRAINY30,
      -- etc.), matching the real Shopify discount codes. Uniqueness/abuse limits
      -- are enforced Shopify-side (per-code usage cap + one-use-per-customer).
      discount_code TEXT NOT NULL,
      shopify_discount_id TEXT,
      assigned_at TEXT,
      expires_at TEXT,
      status TEXT DEFAULT 'available',
      shopify_order_id TEXT,
      order_amount REAL,
      customer_email TEXT,
      customer_phone TEXT,
      used_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id),
      FOREIGN KEY (lead_id) REFERENCES leads(lead_id)
    );

    CREATE TABLE IF NOT EXISTS sms_logs (
      sms_id TEXT PRIMARY KEY,
      lead_id TEXT,
      voucher_id TEXT,
      phone TEXT NOT NULL,
      provider TEXT,
      message_body TEXT,
      delivery_status TEXT DEFAULT 'pending',
      provider_message_id TEXT,
      sent_at TEXT DEFAULT (datetime('now')),
      failed_reason TEXT,
      admin_resend INTEGER DEFAULT 0,
      FOREIGN KEY (lead_id) REFERENCES leads(lead_id),
      FOREIGN KEY (voucher_id) REFERENCES vouchers(voucher_id)
    );

    CREATE TABLE IF NOT EXISTS events (
      event_id TEXT PRIMARY KEY,
      lead_id TEXT,
      campaign_id TEXT,
      event_type TEXT NOT NULL,
      event_source TEXT,
      metadata TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (lead_id) REFERENCES leads(lead_id),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id)
    );

    CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone_normalized);
    CREATE INDEX IF NOT EXISTS idx_leads_campaign ON leads(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_vouchers_campaign_tier ON vouchers(campaign_id, discount_tier, status);
    CREATE INDEX IF NOT EXISTS idx_vouchers_code ON vouchers(discount_code);
    CREATE INDEX IF NOT EXISTS idx_events_lead ON events(lead_id);
    CREATE INDEX IF NOT EXISTS idx_events_campaign ON events(campaign_id);
  `);

  await migrateLeadConsentColumns();
  await migrateVoucherCodeUnique();
}

// The original vouchers table declared `discount_code TEXT NOT NULL UNIQUE`
// (one unique code per voucher). The campaign now uses shared per-tier codes
// (ILJRAINY30 for all 30% winners, etc.), so that UNIQUE must go. SQLite can't
// drop a column constraint in place, so rebuild the table when the old schema is
// detected. Guarded so it runs at most once (only while UNIQUE is still present).
async function migrateVoucherCodeUnique(): Promise<void> {
  const db = getDb();
  const res = await db.execute(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='vouchers'"
  );
  const ddl = res.rows.length ? String((res.rows[0] as Record<string, Val>).sql ?? "") : "";
  if (!/discount_code\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i.test(ddl)) return;

  await db.executeMultiple(`
    PRAGMA foreign_keys=OFF;
    CREATE TABLE vouchers_new (
      voucher_id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      lead_id TEXT,
      discount_tier INTEGER NOT NULL,
      discount_code TEXT NOT NULL,
      shopify_discount_id TEXT,
      assigned_at TEXT,
      expires_at TEXT,
      status TEXT DEFAULT 'available',
      shopify_order_id TEXT,
      order_amount REAL,
      customer_email TEXT,
      customer_phone TEXT,
      used_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id),
      FOREIGN KEY (lead_id) REFERENCES leads(lead_id)
    );
    INSERT INTO vouchers_new SELECT
      voucher_id, campaign_id, lead_id, discount_tier, discount_code,
      shopify_discount_id, assigned_at, expires_at, status, shopify_order_id,
      order_amount, customer_email, customer_phone, used_at, created_at
    FROM vouchers;
    DROP TABLE vouchers;
    ALTER TABLE vouchers_new RENAME TO vouchers;
    CREATE INDEX IF NOT EXISTS idx_vouchers_campaign_tier ON vouchers(campaign_id, discount_tier, status);
    CREATE INDEX IF NOT EXISTS idx_vouchers_code ON vouchers(discount_code);
    PRAGMA foreign_keys=ON;
  `);
}

// Add consent-audit columns to leads if an older DB predates them. SQLite has no
// "ADD COLUMN IF NOT EXISTS", so we check the table info first.
async function migrateLeadConsentColumns(): Promise<void> {
  const db = getDb();
  const info = await db.execute("PRAGMA table_info(leads)");
  const cols = new Set(info.rows.map(r => String((r as Record<string, Val>).name)));
  if (!cols.has("consent_at")) {
    await db.execute("ALTER TABLE leads ADD COLUMN consent_at TEXT");
  }
  if (!cols.has("privacy_policy_version")) {
    await db.execute("ALTER TABLE leads ADD COLUMN privacy_policy_version TEXT");
  }
}

// The real Shopify discount codes. Each tier has ONE shared code (ILJRAINY30 …
// ILJRAINY90) with a fixed quantity; the app hands out that tier's code to up to
// `count` winners. Weighted assignment (assignVoucher) uses `count` as the
// weight, so the expected distribution matches inventory and self-corrects as a
// tier depletes. Total across all tiers = TOTAL_VOUCHERS.
const VOUCHER_CODE_PREFIX = "ILJRAINY";
const VOUCHER_DISTRIBUTION: { tier: number; count: number }[] = [
  { tier: 30, count: 440 },
  { tier: 40, count: 300 },
  { tier: 50, count: 100 },
  { tier: 60, count: 50 },
  { tier: 70, count: 50 },
  { tier: 80, count: 50 },
  { tier: 90, count: 10 },
];
const TOTAL_VOUCHERS = VOUCHER_DISTRIBUTION.reduce((s, d) => s + d.count, 0); // 1000

async function seedDefaultCampaign(): Promise<void> {
  const db = getDb();

  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + 14);

  // Ensure the campaign row exists FIRST -- vouchers have a foreign key on
  // campaign_id, so it must be present before any voucher can be inserted.
  // INSERT OR IGNORE makes this idempotent across cold starts / retries.
  await db.execute({
    sql: `INSERT OR IGNORE INTO campaigns (campaign_id, campaign_name, start_date, end_date, total_voucher_limit, status, source_channel)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      "ilovej_meta_test",
      "iLoveJ Comment-to-DM Voucher Campaign",
      now.toISOString().split("T")[0],
      end.toISOString().split("T")[0],
      TOTAL_VOUCHERS,
      "active",
      "meta",
    ],
  });

  // Gate seeding on the actual voucher count, NOT merely the campaign's
  // existence. This makes the seed self-healing: a previous run that inserted
  // the campaign but was interrupted before finishing the vouchers leaves an
  // incomplete count here, so we clear and re-seed instead of getting stuck.
  const countRes = await db.execute({
    sql: "SELECT COUNT(*) AS c FROM vouchers WHERE campaign_id = ?",
    args: ["ilovej_meta_test"],
  });
  const voucherCount = Number(countRes.rows[0].c);
  if (voucherCount >= TOTAL_VOUCHERS) return;

  // Seed the inventory per VOUCHER_DISTRIBUTION. Each voucher row of a tier
  // carries that tier's shared Shopify code (e.g. every 30% row = ILJRAINY30);
  // the rows still track per-lead assignment, status, expiry, and orders.
  const voucherStmts: { sql: string; args: (string | number)[] }[] = [];
  for (const { tier, count } of VOUCHER_DISTRIBUTION) {
    const code = `${VOUCHER_CODE_PREFIX}${tier}`;
    for (let i = 0; i < count; i++) {
      voucherStmts.push({
        sql: "INSERT INTO vouchers (voucher_id, campaign_id, discount_tier, discount_code, status) VALUES (?, ?, ?, ?, 'available')",
        args: [randomUUID(), "ilovej_meta_test", tier, code],
      });
    }
  }

  // Clear any vouchers left behind by a previously interrupted seed, so a retry
  // produces exactly 1,000 rather than stacking duplicates on top.
  if (voucherCount > 0) {
    await db.execute({
      sql: "DELETE FROM vouchers WHERE campaign_id = ?",
      args: ["ilovej_meta_test"],
    });
  }

  // Insert the vouchers in batches of 200. Each db.batch("write") is atomic and
  // a single network round-trip, so all 1,000 seed in ~5 round-trips -- fast
  // enough for serverless, unlike 1,000 sequential executes (which timed out).
  for (let i = 0; i < voucherStmts.length; i += 200) {
    await db.batch(voucherStmts.slice(i, i + 200), "write");
  }
}

// ─── Row value helpers ────────────────────────────────────────────────────────

type Val = string | number | bigint | null | ArrayBuffer;

function s(v: Val): string { return v == null ? "" : String(v); }
function ns(v: Val): string | null { return v == null ? null : String(v); }
function n(v: Val): number {
  if (v == null) return 0;
  if (typeof v === "bigint") return Number(v);
  return Number(v);
}
function nn(v: Val): number | null {
  if (v == null) return null;
  if (typeof v === "bigint") return Number(v);
  return Number(v);
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Campaign {
  campaign_id: string;
  campaign_name: string;
  start_date: string;
  end_date: string;
  total_voucher_limit: number;
  status: string;
  source_channel: string;
  ad_campaign_id: string | null;
  created_at: string;
}

export interface Lead {
  lead_id: string;
  campaign_id: string;
  name: string | null;
  phone_raw: string;
  phone_normalized: string;
  email: string | null;
  meta_user_id: string | null;
  source: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  consent_voucher_sms: number;
  consent_marketing: number;
  consent_at: string | null;
  privacy_policy_version: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface Voucher {
  voucher_id: string;
  campaign_id: string;
  lead_id: string | null;
  discount_tier: number;
  discount_code: string;
  shopify_discount_id: string | null;
  assigned_at: string | null;
  expires_at: string | null;
  status: string;
  shopify_order_id: string | null;
  order_amount: number | null;
  customer_email: string | null;
  customer_phone: string | null;
  used_at: string | null;
  created_at: string;
}

export interface TierCount {
  discount_tier: number;
  available: number;
  assigned: number;
  sent: number;
  used: number;
  failed: number;
  expired: number;
  total: number;
}

export interface SmsLog {
  sms_id: string;
  lead_id: string | null;
  voucher_id: string | null;
  phone: string;
  provider: string | null;
  message_body: string | null;
  delivery_status: string;
  provider_message_id: string | null;
  sent_at: string;
  failed_reason: string | null;
  admin_resend: number;
}

export interface CampaignSummary {
  total_leads: number;
  total_vouchers_assigned: number;
  total_sms_sent: number;
  total_sms_failed: number;
  total_purchases: number;
  total_revenue: number;
  vouchers_available: number;
  redemption_rate: number;
}

// ─── Row mappers ──────────────────────────────────────────────────────────────

function rowToCampaign(r: Record<string, Val>): Campaign {
  return {
    campaign_id: s(r.campaign_id),
    campaign_name: s(r.campaign_name),
    start_date: s(r.start_date),
    end_date: s(r.end_date),
    total_voucher_limit: n(r.total_voucher_limit),
    status: s(r.status),
    source_channel: s(r.source_channel),
    ad_campaign_id: ns(r.ad_campaign_id),
    created_at: s(r.created_at),
  };
}

function rowToLead(r: Record<string, Val>): Lead {
  return {
    lead_id: s(r.lead_id),
    campaign_id: s(r.campaign_id),
    name: ns(r.name),
    phone_raw: s(r.phone_raw),
    phone_normalized: s(r.phone_normalized),
    email: ns(r.email),
    meta_user_id: ns(r.meta_user_id),
    source: s(r.source),
    utm_source: ns(r.utm_source),
    utm_medium: ns(r.utm_medium),
    utm_campaign: ns(r.utm_campaign),
    utm_content: ns(r.utm_content),
    utm_term: ns(r.utm_term),
    consent_voucher_sms: n(r.consent_voucher_sms),
    consent_marketing: n(r.consent_marketing),
    consent_at: ns(r.consent_at),
    privacy_policy_version: ns(r.privacy_policy_version),
    ip_address: ns(r.ip_address),
    user_agent: ns(r.user_agent),
    created_at: s(r.created_at),
  };
}

function rowToVoucher(r: Record<string, Val>): Voucher {
  return {
    voucher_id: s(r.voucher_id),
    campaign_id: s(r.campaign_id),
    lead_id: ns(r.lead_id),
    discount_tier: n(r.discount_tier),
    discount_code: s(r.discount_code),
    shopify_discount_id: ns(r.shopify_discount_id),
    assigned_at: ns(r.assigned_at),
    expires_at: ns(r.expires_at),
    status: s(r.status),
    shopify_order_id: ns(r.shopify_order_id),
    order_amount: nn(r.order_amount),
    customer_email: ns(r.customer_email),
    customer_phone: ns(r.customer_phone),
    used_at: ns(r.used_at),
    created_at: s(r.created_at),
  };
}

function rowToSmsLog(r: Record<string, Val>): SmsLog {
  return {
    sms_id: s(r.sms_id),
    lead_id: ns(r.lead_id),
    voucher_id: ns(r.voucher_id),
    phone: s(r.phone),
    provider: ns(r.provider),
    message_body: ns(r.message_body),
    delivery_status: s(r.delivery_status),
    provider_message_id: ns(r.provider_message_id),
    sent_at: s(r.sent_at),
    failed_reason: ns(r.failed_reason),
    admin_resend: n(r.admin_resend),
  };
}

// ─── Campaign ─────────────────────────────────────────────────────────────────

export async function getCampaign(campaignId: string): Promise<Campaign | undefined> {
  await ensureReady();
  const res = await getDb().execute({ sql: "SELECT * FROM campaigns WHERE campaign_id = ?", args: [campaignId] });
  return res.rows.length > 0 ? rowToCampaign(res.rows[0] as Record<string, Val>) : undefined;
}

export async function listCampaigns(): Promise<Campaign[]> {
  await ensureReady();
  const res = await getDb().execute({ sql: "SELECT * FROM campaigns ORDER BY created_at DESC", args: [] });
  return res.rows.map(r => rowToCampaign(r as Record<string, Val>));
}

// ─── Lead ─────────────────────────────────────────────────────────────────────

export async function findLeadByPhone(campaignId: string, phoneNormalized: string): Promise<Lead | undefined> {
  await ensureReady();
  const res = await getDb().execute({
    sql: "SELECT * FROM leads WHERE campaign_id = ? AND phone_normalized = ?",
    args: [campaignId, phoneNormalized],
  });
  return res.rows.length > 0 ? rowToLead(res.rows[0] as Record<string, Val>) : undefined;
}

export async function createLead(data: Omit<Lead, "lead_id" | "created_at">): Promise<Lead> {
  await ensureReady();
  const leadId = randomUUID();
  await getDb().execute({
    sql: `INSERT INTO leads (lead_id, campaign_id, name, phone_raw, phone_normalized, email, meta_user_id,
            source, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
            consent_voucher_sms, consent_marketing, consent_at, privacy_policy_version, ip_address, user_agent)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      leadId, data.campaign_id, data.name, data.phone_raw, data.phone_normalized,
      data.email, data.meta_user_id, data.source, data.utm_source, data.utm_medium,
      data.utm_campaign, data.utm_content, data.utm_term,
      data.consent_voucher_sms ? 1 : 0, data.consent_marketing ? 1 : 0,
      data.consent_at, data.privacy_policy_version,
      data.ip_address, data.user_agent,
    ],
  });
  const res = await getDb().execute({ sql: "SELECT * FROM leads WHERE lead_id = ?", args: [leadId] });
  return rowToLead(res.rows[0] as Record<string, Val>);
}

export async function getLeadById(leadId: string): Promise<Lead | undefined> {
  await ensureReady();
  const res = await getDb().execute({ sql: "SELECT * FROM leads WHERE lead_id = ?", args: [leadId] });
  return res.rows.length > 0 ? rowToLead(res.rows[0] as Record<string, Val>) : undefined;
}

export async function listLeads(campaignId?: string, limit = 100, offset = 0): Promise<Lead[]> {
  await ensureReady();
  const res = campaignId
    ? await getDb().execute({
        sql: "SELECT * FROM leads WHERE campaign_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
        args: [campaignId, limit, offset],
      })
    : await getDb().execute({
        sql: "SELECT * FROM leads ORDER BY created_at DESC LIMIT ? OFFSET ?",
        args: [limit, offset],
      });
  return res.rows.map(r => rowToLead(r as Record<string, Val>));
}

// ─── Voucher ──────────────────────────────────────────────────────────────────

export async function getTierCounts(campaignId: string): Promise<TierCount[]> {
  await ensureReady();
  const res = await getDb().execute({
    sql: `SELECT
            discount_tier,
            SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
            SUM(CASE WHEN status = 'assigned' THEN 1 ELSE 0 END) as assigned,
            SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
            SUM(CASE WHEN status = 'used' THEN 1 ELSE 0 END) as used,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
            SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired,
            COUNT(*) as total
          FROM vouchers
          WHERE campaign_id = ?
          GROUP BY discount_tier
          ORDER BY discount_tier`,
    args: [campaignId],
  });
  return res.rows.map(r => ({
    discount_tier: n(r.discount_tier as Val),
    available: n(r.available as Val),
    assigned: n(r.assigned as Val),
    sent: n(r.sent as Val),
    used: n(r.used as Val),
    failed: n(r.failed as Val),
    expired: n(r.expired as Val),
    total: n(r.total as Val),
  }));
}

export async function assignVoucher(
  campaignId: string,
  leadId: string,
  expiresAt: string
): Promise<Voucher | null> {
  await ensureReady();
  const db = getDb();

  const tierCounts = await getTierCounts(campaignId);

  // Weight each tier by its inventory count, so the odds mirror the intended
  // distribution and self-correct as tiers deplete (a tier with 0 available is
  // dropped from the draw).
  const availableTiers = VOUCHER_DISTRIBUTION.filter(w => {
    const tc = tierCounts.find(t => t.discount_tier === w.tier);
    return tc && tc.available > 0;
  });

  if (availableTiers.length === 0) return null;

  const totalWeight = availableTiers.reduce((s, t) => s + t.count, 0);
  let rand = Math.random() * totalWeight;
  let selectedTier = availableTiers[0].tier;
  for (const { tier, count } of availableTiers) {
    rand -= count;
    if (rand <= 0) { selectedTier = tier; break; }
  }

  const tx = await db.transaction("write");
  try {
    const res = await tx.execute({
      sql: "SELECT * FROM vouchers WHERE campaign_id = ? AND discount_tier = ? AND status = 'available' LIMIT 1",
      args: [campaignId, selectedTier],
    });

    if (res.rows.length === 0) {
      await tx.rollback();
      return null;
    }

    const voucherId = s(res.rows[0].voucher_id as Val);

    await tx.execute({
      sql: "UPDATE vouchers SET lead_id = ?, status = 'assigned', assigned_at = datetime('now'), expires_at = ? WHERE voucher_id = ?",
      args: [leadId, expiresAt, voucherId],
    });

    await tx.commit();

    const updated = await db.execute({ sql: "SELECT * FROM vouchers WHERE voucher_id = ?", args: [voucherId] });
    return updated.rows.length > 0 ? rowToVoucher(updated.rows[0] as Record<string, Val>) : null;
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

export async function updateVoucherStatus(voucherId: string, status: string): Promise<void> {
  await ensureReady();
  await getDb().execute({ sql: "UPDATE vouchers SET status = ? WHERE voucher_id = ?", args: [status, voucherId] });
}

export async function getVoucherByCode(code: string): Promise<Voucher | undefined> {
  await ensureReady();
  // Codes are shared per tier (many rows share ILJRAINY30), so for order/webhook
  // attribution pick a voucher actually issued to a customer (assigned/sent) and
  // not yet used, oldest first — this keeps per-tier "used" counts accurate.
  // Exact per-customer attribution isn't possible from a shared code alone.
  const res = await getDb().execute({
    sql: `SELECT * FROM vouchers
          WHERE discount_code = ? AND status IN ('assigned', 'sent')
          ORDER BY assigned_at ASC LIMIT 1`,
    args: [code],
  });
  return res.rows.length > 0 ? rowToVoucher(res.rows[0] as Record<string, Val>) : undefined;
}

export async function getVoucherByLeadId(leadId: string): Promise<Voucher | undefined> {
  await ensureReady();
  const res = await getDb().execute({ sql: "SELECT * FROM vouchers WHERE lead_id = ?", args: [leadId] });
  return res.rows.length > 0 ? rowToVoucher(res.rows[0] as Record<string, Val>) : undefined;
}

export async function markVoucherUsed(
  voucherId: string,
  orderId: string,
  orderAmount: number,
  customerEmail?: string,
  customerPhone?: string
): Promise<void> {
  await ensureReady();
  await getDb().execute({
    sql: `UPDATE vouchers
          SET status = 'used', shopify_order_id = ?, order_amount = ?,
              customer_email = ?, customer_phone = ?, used_at = datetime('now')
          WHERE voucher_id = ?`,
    args: [orderId, orderAmount, customerEmail ?? null, customerPhone ?? null, voucherId],
  });
}

export async function listVouchers(
  campaignId?: string,
  limit = 100,
  offset = 0,
  filters?: { tier?: number; status?: string }
): Promise<Voucher[]> {
  await ensureReady();
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (campaignId) { where.push("campaign_id = ?"); args.push(campaignId); }
  if (filters?.tier != null) { where.push("discount_tier = ?"); args.push(filters.tier); }
  if (filters?.status) { where.push("status = ?"); args.push(filters.status); }
  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  args.push(limit, offset);
  const res = await getDb().execute({
    sql: `SELECT * FROM vouchers ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    args,
  });
  return res.rows.map(r => rowToVoucher(r as Record<string, Val>));
}

// ─── SMS Log ──────────────────────────────────────────────────────────────────

export async function createSmsLog(data: Omit<SmsLog, "sms_id" | "sent_at">): Promise<SmsLog> {
  await ensureReady();
  const smsId = randomUUID();
  await getDb().execute({
    sql: `INSERT INTO sms_logs (sms_id, lead_id, voucher_id, phone, provider, message_body,
            delivery_status, provider_message_id, failed_reason, admin_resend)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      smsId, data.lead_id, data.voucher_id, data.phone, data.provider,
      data.message_body, data.delivery_status, data.provider_message_id,
      data.failed_reason, data.admin_resend ? 1 : 0,
    ],
  });
  const res = await getDb().execute({ sql: "SELECT * FROM sms_logs WHERE sms_id = ?", args: [smsId] });
  return rowToSmsLog(res.rows[0] as Record<string, Val>);
}

export async function updateSmsStatus(
  smsId: string,
  status: string,
  providerId?: string,
  reason?: string
): Promise<void> {
  await ensureReady();
  await getDb().execute({
    sql: "UPDATE sms_logs SET delivery_status = ?, provider_message_id = ?, failed_reason = ? WHERE sms_id = ?",
    args: [status, providerId ?? null, reason ?? null, smsId],
  });
}

// ─── Event ───────────────────────────────────────────────────────────────────

export async function logEvent(
  campaignId: string,
  eventType: string,
  leadId?: string,
  source?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await ensureReady();
  await getDb().execute({
    sql: `INSERT INTO events (event_id, lead_id, campaign_id, event_type, event_source, metadata)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      randomUUID(),
      leadId ?? null,
      campaignId,
      eventType,
      source ?? null,
      metadata ? JSON.stringify(metadata) : null,
    ],
  });
}

// ─── Admin: full reset ────────────────────────────────────────────────────────

/**
 * Wipe all campaign data (events, sms_logs, vouchers, leads, campaign) and
 * re-seed a fresh 1,000-voucher inventory. Deletes in FK-safe order: every
 * child reference must be removed before the row it points at.
 */
export async function resetCampaign(campaignId: string): Promise<{ vouchers: number }> {
  await ensureReady();
  const db = getDb();

  // events, sms_logs and vouchers all reference leads, so clear them first.
  await db.batch(
    [
      { sql: "DELETE FROM events WHERE campaign_id = ?", args: [campaignId] },
      {
        sql: "DELETE FROM sms_logs WHERE lead_id IN (SELECT lead_id FROM leads WHERE campaign_id = ?)",
        args: [campaignId],
      },
      { sql: "DELETE FROM vouchers WHERE campaign_id = ?", args: [campaignId] },
      { sql: "DELETE FROM leads WHERE campaign_id = ?", args: [campaignId] },
      { sql: "DELETE FROM campaigns WHERE campaign_id = ?", args: [campaignId] },
    ],
    "write"
  );

  // Re-seed (seedDefaultCampaign only handles the default campaign id).
  if (campaignId === "ilovej_meta_test") {
    await seedDefaultCampaign();
  }

  const countRes = await db.execute({
    sql: "SELECT COUNT(*) AS c FROM vouchers WHERE campaign_id = ?",
    args: [campaignId],
  });
  return { vouchers: Number(countRes.rows[0].c) };
}

// ─── Dashboard Summary ────────────────────────────────────────────────────────

export async function getCampaignSummary(campaignId: string): Promise<CampaignSummary> {
  await ensureReady();
  const db = getDb();

  const leadsRes = await db.execute({
    sql: "SELECT COUNT(*) as n FROM leads WHERE campaign_id = ?",
    args: [campaignId],
  });
  const totalLeads = n(leadsRes.rows[0]?.n as Val);

  const vRes = await db.execute({
    sql: `SELECT
            SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
            SUM(CASE WHEN status IN ('assigned','sent','used','failed') THEN 1 ELSE 0 END) as assigned,
            SUM(CASE WHEN status = 'used' THEN 1 ELSE 0 END) as used,
            SUM(CASE WHEN status = 'used' THEN order_amount ELSE 0 END) as revenue
          FROM vouchers WHERE campaign_id = ?`,
    args: [campaignId],
  });
  const vr = vRes.rows[0];
  const available = n(vr?.available as Val);
  const assigned = n(vr?.assigned as Val);
  const used = n(vr?.used as Val);
  const revenue = nn(vr?.revenue as Val) ?? 0;

  const smsRes = await db.execute({
    sql: `SELECT
            SUM(CASE WHEN sl.delivery_status IN ('sent','delivered') THEN 1 ELSE 0 END) as sent,
            SUM(CASE WHEN sl.delivery_status = 'failed' THEN 1 ELSE 0 END) as failed
          FROM sms_logs sl
          JOIN leads l ON sl.lead_id = l.lead_id
          WHERE l.campaign_id = ?`,
    args: [campaignId],
  });
  const smsr = smsRes.rows[0];
  const smsSent = n(smsr?.sent as Val);
  const smsFailed = n(smsr?.failed as Val);

  const redemptionRate = assigned > 0 ? Math.round((used / assigned) * 100) : 0;

  return {
    total_leads: totalLeads,
    total_vouchers_assigned: assigned,
    total_sms_sent: smsSent,
    total_sms_failed: smsFailed,
    total_purchases: used,
    total_revenue: revenue,
    vouchers_available: available,
    redemption_rate: redemptionRate,
  };
}
