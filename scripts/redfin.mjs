// Redfin source adapter.
//
// Redfin exposes a public JSON search API ("stingray") that serves cleanly to
// datacenter IPs — the same property that lets Craigslist's API work from GitHub
// Actions. That matters here: commercial rental sites that only server-render
// HTML (Zumper, Apartments.com, HotPads) tend to challenge cloud IPs and return
// nothing in CI, while an open API like this one keeps working. We hit the
// rentals search endpoint for a fixed region (San Francisco), page through the
// full result set, and convert to our apartment shape.
//
// Each Redfin "listing" is a building/property that can span a bedroom range
// (bedRange.min..max) and a price range (rentPriceRange.min..max), so
// `bedrooms`/`price` reflect the building's cheapest unit and the filters are
// deliberately permissive: a building is kept if its bedroom range overlaps what
// we want and its cheapest unit is within the cap. Click through to Redfin for
// the full unit mix.

import { titleCase, detectLaundry, formatPosted, sleep } from './listing-utils.mjs';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const ORIGIN = 'https://www.redfin.com';
// San Francisco. region_type 6 = "city". Hardcoded the same way craigslist.mjs
// pins "sfc" — point these at another region to search elsewhere.
const REGION_ID = '17151';
const REGION_TYPE = '6';
const MARKET = 'sanfrancisco';
// The API caps a single response at ~350 homes, so we page with &start=N.
const PAGE_SIZE = 350;
const MAX_PAGES = 4; // 4 * 350 = 1400 homes of headroom (SF has ~600 rentals)
const PAGE_DELAY_MS = 600;

function searchUrl(start) {
  const params = new URLSearchParams({
    al: '1',
    market: MARKET,
    num_homes: String(PAGE_SIZE),
    region_id: REGION_ID,
    region_type: REGION_TYPE,
    uipt: '1,2,3,4,5,6,7,8',
    v: '8',
  });
  if (start) params.set('start', String(start));
  return `${ORIGIN}/stingray/api/v1/search/rentals?${params}`;
}

// Fetch one page of raw home objects from the rentals API.
async function fetchPage(start) {
  const res = await fetch(searchUrl(start), {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Redfin API failed: ${res.status} (start=${start})`);
  }
  let text = await res.text();
  // stingray prefixes some responses with `{}&&` to defeat JSON hijacking.
  text = text.replace(/^\{\}&&/, '');
  const json = JSON.parse(text);
  return json.homes || [];
}

// Fetch every home across pages, deduped by propertyId. A failure on the first
// page throws (real outage); a failure on a later page stops paging but keeps
// what we already have.
async function fetchAllHomes() {
  const homes = [];
  const seen = new Set();
  for (let page = 0; page < MAX_PAGES; page++) {
    let batch;
    try {
      batch = await fetchPage(page * PAGE_SIZE);
    } catch (err) {
      if (page === 0) throw err;
      break;
    }
    if (!batch.length) break;
    let fresh = 0;
    for (const h of batch) {
      const id = h?.homeData?.propertyId;
      if (id != null && !seen.has(String(id))) {
        seen.add(String(id));
        homes.push(h);
        fresh++;
      }
    }
    if (fresh === 0) break; // ran out of new inventory
    if (batch.length < PAGE_SIZE) break; // last page
    if (page < MAX_PAGES - 1) await sleep(PAGE_DELAY_MS);
  }
  return homes;
}

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

  // Tiered mode: per-bedroom price caps, e.g. { "2": 4500, "3": 7000, "4": 8500, "5": 10000 }. Derive
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

  const homes = await fetchAllHomes();
  const totalAvailable = homes.length;

  let listings = homes.map(parseItem).filter(l => l.address || l.title);

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
    // the building's min price, not per-bedroom prices, so this is permissive.)
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
      `${l.title || ''} ${l.address || ''} ${l.city || ''}`.toLowerCase().includes(q)
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

function parseItem(h) {
  const d = h.homeData || {};
  const r = h.rentalExtension || {};
  const a = d.addressInfo || {};
  const c = a.centroid?.centroid || {};
  const path = typeof d.url === 'string' ? d.url : null;
  const minP = r.rentPriceRange?.min;
  const updated = r.lastUpdated || r.freshnessTimestamp || null;
  let postedIso = new Date().toISOString();
  if (updated) {
    const t = new Date(updated);
    if (!Number.isNaN(t.getTime())) postedIso = t.toISOString();
  }
  return {
    posting_id: d.propertyId != null ? String(d.propertyId) : null,
    title: a.formattedStreetLine || null,
    address: a.formattedStreetLine || null,
    price: typeof minP === 'number' && minP > 0 ? minP : null,
    beds: r.bedRange?.min ?? null,
    maxBeds: r.bedRange?.max ?? null,
    baths: r.bathRange?.min ?? null,
    sqft: r.sqftRange?.min || null,
    neighborhood: '', // Redfin's rentals API doesn't expose a neighborhood name
    city: a.city || '',
    zip: a.zip || '',
    lat: typeof c.latitude === 'number' ? c.latitude : null,
    lon: typeof c.longitude === 'number' ? c.longitude : null,
    date_available: null,
    url: path ? ORIGIN + path : null,
    posted_at: postedIso,
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

// Convert a parsed Redfin listing into the apartment object stored in apartments.json.
export function toApartment(l, now = new Date().toISOString()) {
  const range = l.beds != null && l.maxBeds != null && l.maxBeds !== l.beds
    ? `${l.beds}–${l.maxBeds}bd · ` : '';
  return {
    id: 'rf_' + l.posting_id,
    url: l.url,
    address: l.address || l.title,
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
    notes: `From Redfin · ${range}updated ${formatPosted(l.posted_at)}`,
    seen_by: [],
    added_by: 'redfin',
    source: 'redfin',
    added_at: now,
  };
}

// True if the apartment came from Redfin (so the sync knows to off-market it).
export function isRedfin(apt) {
  return (
    apt.source === 'redfin' ||
    apt.added_by === 'redfin' ||
    (typeof apt.url === 'string' && apt.url.includes('redfin.com'))
  );
}

// --- Off-market detection ----------------------------------------------------
// Redfin detail pages can be bot-walled from datacenter IPs, but the search API
// isn't, so instead of probing each listing URL we fetch the full set of live
// SF rental property IDs once (memoized for the process) and treat a listing as
// gone when its id is no longer in that set. This stays on the CI-safe endpoint
// and makes ~2 requests total regardless of how many listings we're checking.

let liveSetPromise = null;

function loadLiveSet() {
  if (!liveSetPromise) {
    liveSetPromise = (async () => {
      const homes = await fetchAllHomes();
      return new Set(
        homes
          .map(h => h?.homeData?.propertyId)
          .filter(id => id != null)
          .map(String)
      );
    })();
  }
  return liveSetPromise;
}

function propertyIdFromUrl(url) {
  try {
    const segs = new URL(url, ORIGIN).pathname.split('/').filter(Boolean);
    const last = segs[segs.length - 1];
    return /^\d+$/.test(last) ? last : null;
  } catch {
    return null;
  }
}

// Returns true only when we're confident the listing is gone (its property id
// is absent from a successfully-fetched live set). Any failure — can't parse the
// id, the live-set fetch threw, or it came back empty — returns false so we never
// wrongly mark a live listing off-market.
export async function isListingGone(url) {
  const id = propertyIdFromUrl(url);
  if (!id) return false;
  let live;
  try {
    live = await loadLiveSet();
  } catch {
    return false;
  }
  if (!live || live.size === 0) return false;
  return !live.has(id);
}
