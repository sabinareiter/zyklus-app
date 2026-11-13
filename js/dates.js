// Datums-Hilfsfunktionen. Alle Tage werden als "YYYY-MM-DD" (ISO) oder als
// fortlaufende Tagesnummer (Tage seit 1970-01-01, UTC) behandelt – so gibt es
// keine Probleme mit Zeitzonen oder Sommerzeit.

export const DAY_MS = 86400000;
const pad = (n) => String(n).padStart(2, '0');

export function toNum(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function toIso(n) {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(iso, k) {
  return toIso(toNum(iso) + k);
}

export function isValidIso(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && toIso(toNum(s)) === s;
}

const dtf = (o) => new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC', ...o });
const F = {
  long: dtf({ weekday: 'long', day: 'numeric', month: 'long' }),
  full: dtf({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
  med: dtf({ day: 'numeric', month: 'long', year: 'numeric' }),
  short: dtf({ day: 'numeric', month: 'short' }),
  shortY: dtf({ day: 'numeric', month: 'short', year: '2-digit' }),
  dm: dtf({ day: '2-digit', month: '2-digit' }),
  month: dtf({ month: 'long', year: 'numeric' }),
  wd: dtf({ weekday: 'short' }),
};

export function fmt(isoOrN, kind = 'short') {
  const n = typeof isoOrN === 'number' ? isoOrN : toNum(isoOrN);
  return F[kind].format(new Date(n * DAY_MS));
}

/** Wochentag, Montag = 0 … Sonntag = 6 */
export function weekdayIndex(n) {
  return (new Date(n * DAY_MS).getUTCDay() + 6) % 7;
}

export function relDays(k) {
  if (k === 0) return 'heute';
  if (k === 1) return 'morgen';
  if (k === -1) return 'gestern';
  if (k > 0) return `in ${k} Tagen`;
  return `vor ${-k} Tagen`;
}

export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}
