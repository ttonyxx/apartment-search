// Small helpers shared across listing-source adapters (craigslist.mjs, zumper.mjs).

export const sleep = ms => new Promise(r => setTimeout(r, ms));

export function titleCase(s) {
  if (!s) return '';
  return s.replace(/\b([a-z])/g, c => c.toUpperCase());
}

// Best-effort laundry detection from a listing's free text.
export function detectLaundry(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/\b(in[- ]?unit|w\/?d in[- ]?unit|in[- ]?unit w\/?d|laundry in unit|in apartment)\b/.test(t)) return 'in_unit';
  if (/\b(no laundry|no on[- ]?site laundry)\b/.test(t)) return 'none';
  if (/\b(on[- ]?site laundry|laundry on[- ]?site|shared laundry|building laundry|laundry room|coin[- ]?op|on site|laundry)\b/.test(t)) return 'shared';
  return null;
}

export function formatPosted(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
