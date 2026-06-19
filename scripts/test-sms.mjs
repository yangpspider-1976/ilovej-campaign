// Test Movider SMS sending
// Usage: node --env-file=.env.local scripts/test-sms.mjs <phone_number>
// Example: node --env-file=.env.local scripts/test-sms.mjs 09171234567

const raw = process.argv[2];

if (!raw) {
  console.error("Usage: node --env-file=.env.local scripts/test-sms.mjs <phone_number>");
  console.error("Example: node --env-file=.env.local scripts/test-sms.mjs 09171234567");
  process.exit(1);
}

// Normalize PH number to +63 format
function normalize(phone) {
  const cleaned = phone.replace(/[\s\-().]/g, "");
  if (/^\+639\d{9}$/.test(cleaned)) return cleaned;
  if (/^09\d{9}$/.test(cleaned)) return "+63" + cleaned.slice(1);
  if (/^639\d{9}$/.test(cleaned)) return "+" + cleaned;
  return null;
}

const phone = normalize(raw);
if (!phone) {
  console.error(`❌ Invalid Philippine mobile number: ${raw}`);
  console.error("   Accepted formats: 09171234567, +639171234567, 639171234567");
  process.exit(1);
}

const apiKey = process.env.SMS_API_KEY;
const apiSecret = process.env.SMS_API_SECRET;
const from = process.env.SMS_SENDER_ID ?? "iLoveJ";
const provider = process.env.SMS_PROVIDER ?? "mock";

if (provider === "mock") {
  console.log("⚠️  SMS_PROVIDER=mock — no real SMS will be sent.");
  console.log("   Set SMS_PROVIDER=movider in .env.local to send a real SMS.");
  process.exit(0);
}

if (!apiKey || !apiSecret) {
  console.error("❌ SMS_API_KEY and SMS_API_SECRET must be set in .env.local");
  process.exit(1);
}

const message = `[iLoveJ] TEST MESSAGE\n\nThis is a test SMS from your iLoveJ voucher campaign system.\nIf you received this, Movider is working correctly.`;

console.log(`📱 Sending test SMS via ${provider}`);
console.log(`   To:   ${phone}`);
console.log(`   From: ${from}`);
console.log(`   Provider: ${provider}\n`);

const body = new URLSearchParams({ api_key: apiKey, api_secret: apiSecret, to: phone, text: message, from });

const res = await fetch("https://api.movider.net/v1/sms", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body,
});

const data = await res.json();

console.log("Raw API response:");
console.log(JSON.stringify(data, null, 2));
console.log();

if (!res.ok || data.error) {
  console.error(`❌ Failed: ${data.error_text ?? data.error ?? `HTTP ${res.status}`}`);
  process.exit(1);
}

const result = data.phone_number_list?.[0];
if (!result) {
  console.error("❌ No result in response");
  process.exit(1);
}

if (result.status === 1) {
  console.log(`✅ SMS sent successfully!`);
  console.log(`   Message ID: ${result.message_id ?? "n/a"}`);
} else {
  console.error(`❌ Send failed: ${result.error ?? `status ${result.status}`}`);
  process.exit(1);
}
