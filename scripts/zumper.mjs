// Zumper source adapter, mirroring craigslist.mjs.
//
// Zumper has no public API, but it server-renders the current search page's
// results into a Redux state blob in the page HTML, under two arrays:
//   "featured": [ ... ]   (promoted listings, usually 0-1)
//   "listables": [ ... ]  (the page's ~25 organic results)
// We fetch successive pages (?page=N), extract those arrays, filter locally to
// our criteria (the server-rendered results ignore query-string filters), and
// convert to our apartment shape. PadMapper shares this backend.
//
// Each Zumper "listing" is a building/posting that can span a bedroom range
// (min_bedrooms..max_bedrooms) and a price range (min_price..max_price), so the
// filters below are deliberately permissive: a building is kept if its bedroom
// range overlaps what we want and its cheapest unit is within the cap.

import { sleep, titleCase, detectLaundry, formatPosted } from './listing-utils.mjs';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const ORIGIN = 'https://www.zumper.com';
const SEARCH_PATH = '/apartments-for-rent/san-francisco-ca';
// Server-rendered results are a fixed first page regardless of query filters,
// so we page through with ?page=N. Cap the crawl to stay polite.
const MAX_PAGES = 12;
const PAGE_DELAY_MS = 800;

// Fetch + filter + rank listings matching the given criteria.
// criteria: { maxPrice, minPrice, minBeds, maxBeds, query, neighborhoods, limit, priceByBeds, bbox }
export async function fetchListings(criteria = {}) {
  let {
    maxPrice = null,
    minPrice = null,
    minBeds = null,
    maxBeds = null,
    query = null,
    neighborhoods = null,
    limit = 50,
    priceByBeds = null,
    bbox = null,
  } = criteria;

  // Tiered mode: per-bedroom price caps, e.g. { "2": 4500, "3": 7000 }. Derive
  // the bedroom range and overall ceiling, then enforce exact caps below.
  let capByBeds = null;
  if (priceByBeds && typeof priceByBeds === 'object') {
    capByBeds = new Map(
      Object.entries(priceByBeds).map(([k, v]) => [Number(k), Number(v)])
    );
    const beds = [...capByBeds.keys()];
    if (minBeds == null) minBeds = Math.min(...beds);
    if (maxBeds == null) maxBeds = Math.max(...beds);
    if (maxPrice == null) maxPrice = Math.max(...capByBeds.values());
  }

  // Page through, collecting raw listings deduped by id.
  const raw = [];
  const seen = new Set();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = ORIGIN + SEARCH_PATH + (page > 1 ? `?page=${page}` : '');
    const items = await fetchPage(url);
    if (!items.length) break;
    let fresh = 0;
    for (const it of items) {
      if (it && it.listing_id != null && !seen.has(it.listing_id)) {
        seen.add(it.listing_id);
        raw.push(it);
        fresh++;
      }
    }
    if (fresh === 0) break; // ran out of new inventory
    if (page < MAX_PAGES) await sleep(PAGE_DELAY_MS);
  }
  const totalAvailable = raw.length;

  let listings = raw.map(parseItem).filter(l => l.address || l.title);

  // Geographic gate: keep only listings inside the SF bounding box.
  if (bbox) {
    const { minLat, maxLat, minLon, maxLon } = bbox;
    listings = listings.filter(
      l =>
        l.lat != null && l.lon != null &&
        l.lat >= minLat && l.lat <= maxLat &&
        l.lon >= minLon && l.lon <= maxLon
    );
  }

  if (minPrice) listings = listings.filter(l => l.price != null && l.price >= minPrice);

  if (capByBeds) {
    const capBeds = [...capByBeds.keys()];
    const minCapBed = Math.min(...capBeds);
    const maxCapBed = Math.max(...capBeds);
    const overallCap = Math.max(...capByBeds.values());
    // Keep a building if its bedroom range overlaps the bedroom counts we cap,
    // and its cheapest unit is within the highest applicable cap. (We only have
    // the building's min_price, not per-bedroom prices, so this is permissive.)
    listings = listings.filter(l => {
      if (l.price == null) return false;
      const lo = l.beds ?? 0;
      const hi = l.maxBeds ?? lo;
      if (hi < minCapBed || lo > maxCapBed) return false; // no bedroom overlap
      const applicable = capBeds.filter(bd => bd >= lo && bd <= hi).map(bd => capByBeds.get(bd));
      const cap = applicable.length ? Math.max(...applicable) : overallCap;
      return l.price <= cap;
    });
  } else {
    if (maxPrice) listings = listings.filter(l => l.price != null && l.price <= maxPrice);
    // Bedroom-range overlap with [minBeds, maxBeds].
    if (minBeds != null) listings = listings.filter(l => (l.maxBeds ?? l.beds) == null || (l.maxBeds ?? l.beds) >= minBeds);
    if (maxBeds != null) listings = listings.filter(l => l.beds == null || l.beds <= maxBeds);
  }

  if (query) {
    const q = String(query).toLowerCase();
    listings = listings.filter(l =>
      `${l.title || ''} ${l.address || ''} ${l.building_name || ''}`.toLowerCase().includes(q)
    );
  }

  if (neighborhoods && neighborhoods.length) {
    listings = listings.filter(l => {
      const blob = `${l.neighborhood || ''} ${l.address || ''} ${l.title || ''}`.toLowerCase();
      const match = neighborhoods.find(needle => blob.includes(needle));
      if (match) l.matchedNeighborhood = match;
      return Boolean(match);
    });
  }

  listings.sort((a, b) => score(b, capByBeds) - score(a, capByBeds));
  listings = listings.slice(0, limit);

  return { listings, totalAvailable };
}

// Fetch one search page and pull out the server-rendered listing arrays.
async function fetchPage(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
  if (!res.ok) {
    throw new Error(`Zumper page failed: ${res.status} ${url}`);
  }
  const html = await res.text();
  return [...sliceArray(html, /"featured":\[\{/), ...sliceArray(html, /"listables":\[\{/)];
}

// Find a JSON array embedded in the page that starts at the first non-empty
// occurrence of `keyRe` (e.g. /"listables":\[\{/), bracket-match it, and parse.
function sliceArray(html, keyRe) {
  const m = html.match(keyRe);
  if (!m) return [];
  const start = html.indexOf('[', m.index);
  let depth = 0;
  let i = start;
  for (; i < html.length; i++) {
    const c = html[i];
    if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) { i++; break; }
    }
  }
  try {
    return JSON.parse(html.slice(start, i));
  } catch {
    return [];
  }
}

function parseItem(it) {
  const postedEpoch = it.listed_on || it.created_on || null;
  const path = typeof it.url === 'string' ? it.url : null;
  return {
    posting_id: it.listing_id,
    title: it.title || it.building_name || it.address || null,
    address: it.address || null,
    building_name: it.building_name || null,
    price: typeof it.min_price === 'number' && it.min_price > 0 ? it.min_price : null,
    beds: it.min_bedrooms ?? null,
    maxBeds: it.max_bedrooms ?? null,
    baths: it.min_bathrooms ?? null,
    sqft: it.min_square_feet || null,
    neighborhood: it.neighborhood_name || '',
    lat: typeof it.lat === 'number' ? it.lat : null,
    lon: typeof it.lng === 'number' ? it.lng : null,
    date_available: it.date_available || null,
    path,
    url: path ? ORIGIN + path : null,
    posted_at: postedEpoch ? new Date(postedEpoch * 1000).toISOString() : new Date().toISOString(),
  };
}

function score(l, capByBeds = null) {
  let s = 0;
  if (capByBeds) {
    const cap = capByBeds.get(l.beds);
    if (cap && l.price) s += Math.max(0, (cap - l.price) / cap) * 5;
  } else {
    if (l.beds === 1 || l.beds === 2) s += 5;
    else if (l.beds === 0) s -= 2;
    else if (l.beds == null) s -= 1;
    if (l.price) s += Math.max(0, (4500 - l.price) / 1000);
  }
  if (l.sqft) s += Math.min(l.sqft / 200, 5);
  const ageDays = (Date.now() - new Date(l.posted_at).getTime()) / 86400000;
  if (ageDays < 1) s += 2;
  else if (ageDays < 3) s += 1;
  return s;
}

// Convert a parsed Zumper listing into the apartment object stored in apartments.json.
export function toApartment(l, now = new Date().toISOString()) {
  const range = l.beds != null && l.maxBeds != null && l.maxBeds !== l.beds
    ? `${l.beds}–${l.maxBeds}bd · ` : '';
  const address = l.building_name && l.address
    ? `${l.building_name} — ${l.address}`
    : (l.address || l.title);
  return {
    id: 'zm_' + l.posting_id,
    url: l.url,
    address,
    neighborhood: titleCase(l.matchedNeighborhood || l.neighborhood),
    price: l.price,
    bedrooms: l.beds,
    bathrooms: l.baths,
    sqft: l.sqft,
    available: l.date_available,
    status: 'to_see',
    laundry: detectLaundry(`${l.title || ''} ${l.address || ''}`),
    lat: l.lat || null,
    lon: l.lon || null,
    notes: `From Zumper · ${range}listed ${formatPosted(l.posted_at)}`,
    seen_by: [],
    added_by: 'zumper',
    source: 'zumper',
    added_at: now,
  };
}

// True if the apartment came from Zumper (so the sync knows to off-market it).
export function isZumper(apt) {
  return (
    apt.source === 'zumper' ||
    apt.added_by === 'zumper' ||
    (typeof apt.url === 'string' && apt.url.includes('zumper.com'))
  );
}

// Check whether a single Zumper listing has been taken down. A dead listing
// redirects from its detail path (/apartment-buildings/{id}/...) to the city
// search page, so we treat "redirected to a bare city-search URL" (or 404/410)
// as gone. Anything else — including transient/network errors — is not gone.
export async function isListingGone(url) {
  try {
    const reqPath = new URL(url).pathname;
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Referer: ORIGIN + SEARCH_PATH },
      redirect: 'follow',
    });
    if (res.status === 404 || res.status === 410) return true;
    if (!res.ok) return false; // be conservative
    const finalPath = new URL(res.url).pathname;
    if (finalPath === reqPath) return false; // still on the detail page
    // Redirected to a generic city-search page (no listing/building id) => gone.
    return /^\/apartments-for-rent\/[^/]+\/?$/.test(finalPath);
  } catch {
    return false; // network error — be conservative
  }
}
