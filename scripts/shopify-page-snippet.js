/**
 * iLoveJ Voucher Claim — Shopify Page Snippet
 *
 * Paste this into your Shopify page's "Additional scripts" or
 * Online Store > Themes > Edit Code > Add to the bottom of the page template.
 *
 * Replace CAMPAIGN_API_URL with your deployed Next.js app URL.
 */

(function () {
  // ── CONFIG ──────────────────────────────────────────────────────────────────
  const CAMPAIGN_API_URL = "https://YOUR-VERCEL-APP.vercel.app/api/voucher/claim";
  // ────────────────────────────────────────────────────────────────────────────

  const form = document.querySelector("form");
  if (!form) return;

  // Inject result message container after the form's submit button
  const resultBox = document.createElement("div");
  resultBox.id = "ilovej-result";
  resultBox.style.cssText = "margin-top:20px;padding:16px;border-radius:8px;font-size:15px;display:none;text-align:center;";
  form.appendChild(resultBox);

  function showMessage(text, isError) {
    resultBox.textContent = text;
    resultBox.style.display = "block";
    resultBox.style.background = isError ? "#ffeaea" : "#eaffea";
    resultBox.style.color = isError ? "#b00020" : "#1a5c2a";
    resultBox.style.border = isError ? "1px solid #f5c2c2" : "1px solid #a8d5b0";
  }

  function getPhone() {
    // Shopify phone inputs: may have a country-code prefix selector
    // Try the visible text input with type="tel" first
    const telInput = form.querySelector('input[type="tel"]') ||
                     form.querySelector('input[name*="phone"]') ||
                     form.querySelector('input[placeholder*="Phone"]') ||
                     form.querySelector('input[placeholder*="phone"]');
    if (!telInput) return "";

    let val = telInput.value.trim();

    // Strip spaces/dashes
    val = val.replace(/[\s\-().]/g, "");

    // If the Shopify selector already prefixed +63, keep it.
    // If the user typed just 9171234567 (without leading 0), add +63.
    if (/^\+639\d{9}$/.test(val)) return val;
    if (/^09\d{9}$/.test(val)) return "+63" + val.slice(1);
    if (/^639\d{9}$/.test(val)) return "+" + val;
    if (/^9\d{9}$/.test(val)) return "+63" + val;  // no leading 0
    return val; // pass through; server will validate
  }

  function getField(attr) {
    return (form.querySelector(`input[name*="${attr}"], input[placeholder*="${attr}"], input[type="${attr}"]`) || {}).value || "";
  }

  function getConsent(labelText) {
    const labels = form.querySelectorAll("label");
    for (const label of labels) {
      if (label.textContent.toLowerCase().includes(labelText.toLowerCase())) {
        const cb = label.querySelector('input[type="checkbox"]') ||
                   document.getElementById(label.htmlFor);
        return cb ? cb.checked : false;
      }
    }
    // Fallback: first checkbox = SMS consent, second = marketing
    const checkboxes = form.querySelectorAll('input[type="checkbox"]');
    if (labelText.toLowerCase().includes("email") || labelText.toLowerCase().includes("sms")) {
      return checkboxes[0]?.checked ?? false;
    }
    return checkboxes[1]?.checked ?? false;
  }

  function getUtm(key) {
    return new URLSearchParams(window.location.search).get(key) || undefined;
  }

  function setSubmitState(btn, loading) {
    if (!btn) return;
    if (loading) {
      btn._origText = btn.value || btn.textContent;
      btn.disabled = true;
      if (btn.tagName === "INPUT") btn.value = "Processing…";
      else btn.textContent = "Processing…";
    } else {
      btn.disabled = false;
      if (btn.tagName === "INPUT") btn.value = btn._origText || "Submit";
      else btn.textContent = btn._origText || "Submit";
    }
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    e.stopPropagation();

    const submitBtn = form.querySelector('input[type="submit"], button[type="submit"], button:not([type])');
    setSubmitState(submitBtn, true);
    resultBox.style.display = "none";

    const phone = getPhone();
    const name = getField("name");
    const email = getField("email");
    const consentSms = getConsent("sms") || getConsent("email") || getConsent("consent");
    const consentMarketing = getConsent("marketing") || getConsent("promotional");

    if (!phone) {
      showMessage("Please enter your mobile number.", true);
      setSubmitState(submitBtn, false);
      return;
    }

    try {
      const res = await fetch(CAMPAIGN_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          name: name || undefined,
          email: email || undefined,
          campaign_id: "ilovej_meta_test",
          consent_voucher_sms: true,   // form submission implies consent
          consent_marketing: consentMarketing,
          utm_source: getUtm("utm_source") || "shopify",
          utm_medium: getUtm("utm_medium"),
          utm_campaign: getUtm("utm_campaign"),
          utm_content: getUtm("utm_content"),
          utm_term: getUtm("utm_term"),
        }),
      });

      const data = await res.json();

      if (data.already_claimed) {
        showMessage("✅ This number already has a voucher. Please check your SMS inbox!", false);
        return;
      }

      if (!data.success) {
        showMessage("❌ " + (data.error || "Something went wrong. Please try again."), true);
        return;
      }

      if (data.sms_sent) {
        showMessage(
          `🎉 You got ${data.discount_tier}% OFF! Your voucher code was sent to your mobile number via SMS.`,
          false
        );
      } else {
        showMessage(
          `✅ Voucher claimed! SMS delivery had an issue — please contact support if you don't receive it.`,
          false
        );
      }

      form.reset();
    } catch (err) {
      showMessage("Network error. Please check your connection and try again.", true);
    } finally {
      setSubmitState(submitBtn, false);
    }
  });
})();
