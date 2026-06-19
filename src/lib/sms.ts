// SMS service — provider-agnostic interface
// Configure via environment variables:
//   SMS_PROVIDER=movider|twilio|infobip|clicksend|mock
//   SMS_API_KEY, SMS_API_SECRET, SMS_SENDER_ID

export interface SmsResult {
  success: boolean;
  provider_message_id?: string;
  error?: string;
}

export function buildVoucherMessage(
  discountCode: string,
  discountTier: number,
  expiresAt: string,
  shopifyUrl?: string
): string {
  const expiry = new Date(expiresAt).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const base = `[iLoveJ] Your discount voucher is ready.\n\nCode: ${discountCode}\nDiscount: ${discountTier}% OFF\nValid until: ${expiry}\nOne-time use only.`;

  if (shopifyUrl) {
    return `${base}\n\nShop now: ${shopifyUrl}\nReply STOP to opt out.`;
  }

  return `${base}\n\nUse it at checkout on our Shopify store.`;
}

export async function sendSms(phone: string, message: string): Promise<SmsResult> {
  const provider = process.env.SMS_PROVIDER ?? "mock";

  if (provider === "movider") return sendViaMovider(phone, message);
  if (provider === "twilio") return sendViaTwilio(phone, message);
  if (provider === "infobip") return sendViaInfobip(phone, message);
  if (provider === "clicksend") return sendViaClickSend(phone, message);

  // Mock provider — logs the message; use in development
  console.log(`[SMS MOCK] To: ${phone}\n${message}\n`);
  return { success: true, provider_message_id: `mock_${Date.now()}` };
}

// ─── Movider (Philippines) ───────────────────────────────────────────────────
// Docs: https://developer.movider.co
// Env vars:
//   SMS_API_KEY    = your Movider API key
//   SMS_API_SECRET = your Movider API secret
//   SMS_SENDER_ID  = approved sender name (optional, defaults to "iLoveJ")

async function sendViaMovider(phone: string, message: string): Promise<SmsResult> {
  const apiKey = process.env.SMS_API_KEY;
  const apiSecret = process.env.SMS_API_SECRET;
  let from = process.env.SMS_SENDER_ID ?? "iLoveJ";
  let text = message;

  // Trial-mode override: Movider trial accounts can ONLY use the default sender
  // name and the default "stability check" message -- custom sender/text are
  // rejected. Set MOVIDER_TRIAL_MODE=true to prove end-to-end delivery on a
  // trial account before upgrading. Remove the env var to send real vouchers.
  if (process.env.MOVIDER_TRIAL_MODE === "true") {
    from = process.env.MOVIDER_TRIAL_SENDER ?? "DemoP";
    text = process.env.MOVIDER_TRIAL_MESSAGE ?? "Good Day! This is a SMS for checking stability.";
  }

  if (!apiKey || !apiSecret) {
    return { success: false, error: "Movider credentials not configured (SMS_API_KEY, SMS_API_SECRET)" };
  }

  const body = new URLSearchParams({
    api_key: apiKey,
    api_secret: apiSecret,
    to: phone,
    text,
    from,
  });

  try {
    const res = await fetch("https://api.movider.co/v1/sms", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const data = await res.json() as {
      phone_number_list?: Array<{
        phone_number: string;
        status: number;       // 1 = success
        message_id?: string;
        error?: string;
      }>;
      error?: string;
      error_text?: string;
    };

    if (!res.ok || data.error) {
      return {
        success: false,
        error: data.error_text ?? data.error ?? `Movider HTTP ${res.status}`,
      };
    }

    const result = data.phone_number_list?.[0];
    if (!result) {
      return { success: false, error: "Movider: empty response" };
    }

    if (result.status !== 1) {
      return {
        success: false,
        error: result.error ?? `Movider status ${result.status}`,
      };
    }

    return { success: true, provider_message_id: result.message_id };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// ─── Twilio ──────────────────────────────────────────────────────────────────

async function sendViaTwilio(phone: string, message: string): Promise<SmsResult> {
  const accountSid = process.env.SMS_API_KEY;
  const authToken = process.env.SMS_API_SECRET;
  const from = process.env.SMS_SENDER_ID ?? process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !from) {
    return { success: false, error: "Twilio credentials not configured" };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const body = new URLSearchParams({ To: phone, From: from, Body: message });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const data = await res.json() as { sid?: string; message?: string };
    if (!res.ok) return { success: false, error: data.message ?? "Twilio error" };
    return { success: true, provider_message_id: data.sid };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// ─── Infobip ─────────────────────────────────────────────────────────────────

async function sendViaInfobip(phone: string, message: string): Promise<SmsResult> {
  const apiKey = process.env.SMS_API_KEY;
  const baseUrl = process.env.INFOBIP_BASE_URL;
  const sender = process.env.SMS_SENDER_ID ?? "iLoveJ";

  if (!apiKey || !baseUrl) {
    return { success: false, error: "Infobip credentials not configured" };
  }

  try {
    const res = await fetch(`${baseUrl}/sms/2/text/advanced`, {
      method: "POST",
      headers: {
        Authorization: `App ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        messages: [{ from: sender, destinations: [{ to: phone }], text: message }],
      }),
    });
    const data = await res.json() as { messages?: Array<{ messageId?: string; status?: { groupName?: string; description?: string } }> };
    if (!res.ok) return { success: false, error: "Infobip error" };
    const msg = data.messages?.[0];
    return {
      success: msg?.status?.groupName !== "REJECTED",
      provider_message_id: msg?.messageId,
      error: msg?.status?.groupName === "REJECTED" ? msg.status?.description : undefined,
    };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// ─── ClickSend ───────────────────────────────────────────────────────────────

async function sendViaClickSend(phone: string, message: string): Promise<SmsResult> {
  const username = process.env.SMS_API_KEY;
  const apiKey = process.env.SMS_API_SECRET;
  const sender = process.env.SMS_SENDER_ID ?? "iLoveJ";

  if (!username || !apiKey) {
    return { success: false, error: "ClickSend credentials not configured" };
  }

  try {
    const res = await fetch("https://rest.clicksend.com/v3/sms/send", {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${username}:${apiKey}`).toString("base64"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [{ source: "sdk", body: message, to: phone, from: sender }],
      }),
    });
    const data = await res.json() as { data?: { messages?: Array<{ message_id?: string; status?: string }> } };
    if (!res.ok) return { success: false, error: "ClickSend error" };
    const msg = data.data?.messages?.[0];
    return {
      success: msg?.status === "SUCCESS",
      provider_message_id: msg?.message_id,
    };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
