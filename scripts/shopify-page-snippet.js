(function () {
  const CAMPAIGN_API_URL = "https://ilovej-campaign.vercel.app/api/voucher/claim";

  function init() {
    const form = document.querySelector("form");
    if (!form) return;

    const resultBox = document.createElement("div");
    resultBox.style.cssText = "margin:20px auto;max-width:480px;padding:16px;border-radius:8px;font-size:15px;display:none;text-align:center;font-weight:600;";
    form.after(resultBox);

    function showMessage(text, isError) {
      resultBox.innerHTML = text;
      resultBox.style.display = "block";
      resultBox.style.background = isError ? "#ffeaea" : "#eaffea";
      resultBox.style.color = isError ? "#b00020" : "#1a5c2a";
      resultBox.style.border = isError ? "1px solid #f5c2c2" : "1px solid #a8d5b0";
    }

    function getPhone() {
      const input = form.querySelector('input[type="tel"]')
        || form.querySelector('input[name*="phone"]')
        || form.querySelector('input[placeholder*="Phone"]')
        || form.querySelector('input[placeholder*="phone"]');
      if (!input) return "";
      let v = input.value.trim().replace(/[\s\-()+.]/g, "");
      // Shopify phone selector pre-fills +63, so strip it before re-adding
      v = v.replace(/^63/, "");   // remove leading 63
      v = v.replace(/^0/, "");    // remove leading 0
      if (/^9\d{9}$/.test(v)) return "+63" + v;
      return input.value.trim(); // pass through; server validates
    }

    function getField(attr) {
      return (form.querySelector(`input[name*="${attr}"], input[placeholder*="${attr}"]`) || {}).value || "";
    }

    function getCheckbox(idx) {
      return form.querySelectorAll('input[type="checkbox"]')[idx]?.checked ?? false;
    }

    function getUtm(key) {
      return new URLSearchParams(window.location.search).get(key) || undefined;
    }

    function setLoading(btn, loading) {
      if (!btn) return;
      if (loading) {
        btn._orig = btn.value || btn.textContent;
        btn.disabled = true;
        if (btn.tagName === "INPUT") btn.value = "Processing…";
        else btn.textContent = "Processing…";
      } else {
        btn.disabled = false;
        if (btn.tagName === "INPUT") btn.value = btn._orig || "Submit";
        else btn.textContent = btn._orig || "Submit";
        btn._processing = false;
      }
    }

    async function handleSubmit(e) {
      e.preventDefault();
      e.stopImmediatePropagation();

      const btn = form.querySelector('input[type="submit"], button[type="submit"], button:not([type])');
      if (btn && btn._processing) return;
      if (btn) btn._processing = true;

      setLoading(btn, true);
      resultBox.style.display = "none";

      const phone = getPhone();
      if (!phone) {
        showMessage("❌ Please enter your mobile number.", true);
        setLoading(btn, false);
        return;
      }

      try {
        const res = await fetch(CAMPAIGN_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone,
            name: getField("name") || undefined,
            email: getField("email") || undefined,
            campaign_id: "ilovej_meta_test",
            consent_voucher_sms: true,
            consent_marketing: getCheckbox(1),
            utm_source: getUtm("utm_source") || "shopify",
            utm_medium: getUtm("utm_medium"),
            utm_campaign: getUtm("utm_campaign"),
          }),
        });

        const data = await res.json();

        if (data.already_claimed) {
          showMessage("✅ This number already has a voucher — please check your SMS inbox!", false);
        } else if (!data.success) {
          showMessage("❌ " + (data.error || "Something went wrong. Please try again."), true);
        } else if (data.sms_sent) {
          showMessage(`🎉 You got ${data.discount_tier}% OFF!<br>Your voucher code was sent to your mobile via SMS.`, false);
          form.reset();
        } else {
          showMessage("✅ Voucher claimed! If you don't receive an SMS within a few minutes, please contact support.", false);
          form.reset();
        }
      } catch {
        showMessage("❌ Network error. Please check your connection and try again.", true);
      } finally {
        setLoading(btn, false);
      }
    }

    // Use capture phase to run before Shopify section's own handler
    form.addEventListener("submit", handleSubmit, true);

    // Also intercept submit button click directly
    const btn = form.querySelector('input[type="submit"], button[type="submit"], button:not([type])');
    if (btn) {
      btn.addEventListener("click", function(e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      }, true);
    }
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(init, 0);
  } else {
    window.addEventListener("DOMContentLoaded", init);
  }
})();
