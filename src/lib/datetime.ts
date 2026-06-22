// Date/time formatting for the admin UI.
//
// The DB stores timestamps via SQLite's datetime('now'), which is UTC but
// written WITHOUT a timezone marker (e.g. "2026-06-22 02:12:00"). new Date()
// would treat that as local time, and since the admin pages are Server
// Components they render on Vercel (UTC) — so we must (1) parse the value as
// UTC and (2) force the Philippine timezone when formatting.

const PH_TZ = "Asia/Manila";

/** Parse a SQLite UTC timestamp string into a Date, treating it as UTC. */
function parseUtc(value: string): Date {
  // Already has a timezone (Z or ±hh:mm)? Use as-is. Otherwise mark it UTC.
  const hasTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(value.trim());
  const iso = value.trim().replace(" ", "T") + (hasTz ? "" : "Z");
  return new Date(iso);
}

/** "Jun 22, 10:12 AM" in Philippine time. */
export function formatDateTimePH(value: string | null | undefined): string {
  if (!value) return "—";
  return parseUtc(value).toLocaleString("en-PH", {
    timeZone: PH_TZ,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "Jun 22, 2026" in Philippine time. */
export function formatDatePH(value: string | null | undefined): string {
  if (!value) return "—";
  return parseUtc(value).toLocaleString("en-PH", {
    timeZone: PH_TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
