// Movider SMS diagnostic — send ONE controlled message and dump the FULL raw
// response, so we can isolate WHY delivery differs between senders/messages.
//
// Usage (PowerShell or bash):
//   node scripts/test-sms.mjs --to 09171234567 --from dASO  --text "test 123"
//   node scripts/test-sms.mjs --to 09171234567 --from DemoP --text "test 123"
//   node scripts/test-sms.mjs --to 09171234567 --from dASO  --voucher
//
// The point: change ONE thing at a time.
//   1) Same short text, swap DemoP <-> dASO   -> tells you if the SENDER is the problem.
//   2) Same dASO sender, --text vs --voucher  -> tells you if the CONTENT is the problem.
//
// Creds are read from .env.local (real env vars take precedence).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- load .env.local (simple parser, no deps) ---------------------------------
function loadEnvLocal() {
  try {
    const raw = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      const val = m[2].replace(/^["']|["']$/g, "");
      if (process.env[key] === undefined) process.env[key] = val; // real env wins
    }
  } catch {
    /* no .env.local — rely on real env */
  }
}
loadEnvLocal();

// --- args ---------------------------------------------------------------------
const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}
const hasFlag = (name) => args.includes(`--${name}`);

// Normalize PH number to +63 format
function normalize(phone) {
  const cleaned = (phone ?? "").replace(/[\s\-().]/g, "");
  if (/^\+639\d{9}$/.test(cleaned)) return cleaned;
  if (/^09\d{9}$/.test(cleaned)) return "+63" + cleaned.slice(1);
  if (/^639\d{9}$/.test(cleaned)) return "+" + cleaned;
  return null;
}

const to = normalize(arg("to"));
const from = arg("from", process.env.SMS_SENDER_ID ?? "iLoveJ");

// Replica of buildVoucherMessage() so we test the EXACT production text.
function voucherMessage(code = "ILOVEJ30-TEST", tier = 30) {
  return (
    `Thanks for joining ILOVEJ Rainy Giveaway! ` +
    `Search ilovej ph on Google for ${tier}% OFF Korean kidswear.\n\n` +
    `Voucher code: ${code}\n` +
    `Valid for 2 weeks.`
  );
}

const text = hasFlag("voucher")
  ? voucherMessage()
  : arg("text", "Good Day! This is a SMS for checking stability.");

if (!to) {
  console.error("ERROR: --to is required and must be a valid PH number, e.g. --to 09171234567");
  process.exit(1);
}

const apiKey = process.env.SMS_API_KEY;
const apiSecret = process.env.SMS_API_SECRET;
if (!apiKey || !apiSecret) {
  console.error("ERROR: SMS_API_KEY / SMS_API_SECRET not found (.env.local or env).");
  process.exit(1);
}

// --- rough GSM-7 segment estimate (for context only) --------------------------
const len = text.length;
const segments = len <= 160 ? 1 : Math.ceil(len / 153);

console.log("──────────────────────────────────────────────");
console.log("Sending via Movider (https://api.movider.co/v1/sms):");
console.log("  to      :", to);
console.log("  from    :", from);
console.log("  chars   :", len, `(~${segments} segment${segments > 1 ? "s" : ""})`);
console.log("  api_key :", apiKey.slice(0, 6) + "…");
console.log("  text    :");
console.log(text.split("\n").map((l) => "    | " + l).join("\n"));
console.log("──────────────────────────────────────────────");

const body = new URLSearchParams({
  api_key: apiKey,
  api_secret: apiSecret,
  to,
  text,
  from,
});

try {
  const res = await fetch("https://api.movider.co/v1/sms", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const rawText = await res.text();
  console.log("HTTP status:", res.status, res.statusText);
  console.log("RAW RESPONSE:");
  try {
    console.log(JSON.stringify(JSON.parse(rawText), null, 2));
  } catch {
    console.log(rawText);
  }
} catch (e) {
  console.error("FETCH FAILED:", e);
  process.exit(1);
}

// Also pull current balance so you can confirm whether this send was charged.
try {
  const bal = await fetch("https://api.movider.co/v1/balance", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ api_key: apiKey, api_secret: apiSecret }),
  });
  console.log("──────────────────────────────────────────────");
  console.log("Balance after send:", await bal.text());
} catch {
  /* ignore */
}
