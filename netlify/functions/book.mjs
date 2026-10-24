import { getStore } from "@netlify/blobs";

/*
 * Stores a submitted booking so the scheduled reminder function can text the
 * guest on the day of their booking. The booking EMAIL (via FormSubmit) is the
 * source of truth for the cafe; this storage only powers the day-of SMS.
 *
 * Bookings are grouped by date: the blob key is the ISO date ("YYYY-MM-DD")
 * and the value is an array of that day's bookings.
 */
export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let b;
  try {
    b = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const date = String(b.date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response("Bad or missing date", { status: 400 });
  }

  const store = getStore("bookings");
  const list = (await store.get(date, { type: "json" })) || [];

  list.push({
    name: String(b.name || "").slice(0, 120),
    phone: String(b.phone || "").slice(0, 40),
    email: String(b.email || "").slice(0, 160),
    time: String(b.time || "").slice(0, 20),
    guests: String(b.guests || "").slice(0, 10),
    notes: String(b.notes || "").slice(0, 300),
    reminded: false,
    createdAt: new Date().toISOString(),
  });

  await store.setJSON(date, list);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
