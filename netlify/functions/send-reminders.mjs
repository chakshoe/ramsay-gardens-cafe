import { getStore } from "@netlify/blobs";

/*
 * Runs on a schedule (cron is UTC). "0 21 * * *" is 21:00 UTC, which is ~8am
 * in Melbourne during daylight saving (AEDT, Oct–Apr) and ~7am otherwise
 * (AEST). Adjust the schedule below if you'd prefer a different send time.
 *
 * It reads today's bookings from the "bookings" store and sends each guest an
 * SMS reminder via Twilio. Already-reminded bookings are skipped so a re-run
 * never double-texts.
 *
 * Required environment variables (set these in Netlify → Site settings →
 * Environment variables):
 *   TWILIO_ACCOUNT_SID  – your Twilio Account SID (starts with "AC...")
 *   TWILIO_AUTH_TOKEN   – your Twilio Auth Token
 *   TWILIO_FROM         – your Twilio phone number (+61...) or an approved
 *                         alphanumeric sender ID (e.g. "RamsayGdns")
 */
export const config = { schedule: "0 21 * * *" };

export default async () => {
  const SID = process.env.TWILIO_ACCOUNT_SID;
  const TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const FROM = process.env.TWILIO_FROM;

  if (!SID || !TOKEN || !FROM) {
    console.error("Missing Twilio env vars (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM).");
    return new Response("Missing Twilio configuration", { status: 500 });
  }

  // "Today" in Melbourne — booking dates are stored as the guest's local date.
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const store = getStore("bookings");
  const list = (await store.get(today, { type: "json" })) || [];

  if (!list.length) {
    return new Response(JSON.stringify({ today, sent: 0, note: "no bookings today" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  let sent = 0, failed = 0, skipped = 0, changed = false;

  for (const bk of list) {
    if (bk.reminded) { skipped++; continue; }

    const to = normalizeAU(bk.phone);
    if (!to) { skipped++; continue; }

    const first = (bk.name || "there").trim().split(/\s+/)[0];
    const body =
      `Hi ${first}, a reminder of your booking at Ramsay Gardens Cafe today` +
      (bk.time ? ` at ${bk.time}` : "") +
      (bk.guests ? ` for ${bk.guests}` : "") +
      `. See you soon! Changes? Call 0421 244 837.`;

    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: FROM, Body: body }),
      });

      if (res.ok) {
        bk.reminded = true;
        sent++;
        changed = true;
      } else {
        failed++;
        console.error("Twilio error", res.status, await res.text());
      }
    } catch (e) {
      failed++;
      console.error("SMS send failed", e);
    }
  }

  if (changed) await store.setJSON(today, list);

  return new Response(JSON.stringify({ today, sent, failed, skipped }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

// Turn an Australian number into E.164 (+61...). Returns null if it doesn't
// look like a valid number we can text.
function normalizeAU(raw) {
  let s = String(raw || "").replace(/[^\d+]/g, "");
  if (!s) return null;
  if (s.startsWith("+")) return s.length >= 11 ? s : null;
  if (s.startsWith("0")) s = "61" + s.slice(1);
  else if (s.startsWith("61")) { /* already has country code */ }
  else if (s.length === 9) s = "61" + s; // mobile missing the leading 0
  else return null;
  return "+" + s;
}
