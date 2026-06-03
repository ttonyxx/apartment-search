// Registry of listing sources the sync knows how to pull from.
//
// Each adapter exposes:
//   id            short id (also used as the apartment id prefix, e.g. "cl_", "zm_")
//   label         human label for logs
//   fetchListings(criteria) -> { listings, totalAvailable }
//   toApartment(listing, now) -> apartment object
//   isMine(apt) -> bool          which existing apartments belong to this source
//   isListingGone(url) -> bool   OPTIONAL; omit to skip the off-market sweep
//
// To add a source: write an adapter module (see craigslist.mjs / zumper.mjs)
// and register it here.

import * as craigslist from './craigslist.mjs';
import * as zumper from './zumper.mjs';

export const SOURCES = {
  craigslist: {
    id: 'craigslist',
    label: 'Craigslist',
    fetchListings: craigslist.fetchListings,
    toApartment: craigslist.toApartment,
    isMine: craigslist.isCraigslist,
    isListingGone: craigslist.isListingGone,
  },
  zumper: {
    id: 'zumper',
    label: 'Zumper',
    fetchListings: zumper.fetchListings,
    toApartment: zumper.toApartment,
    isMine: zumper.isZumper,
    isListingGone: zumper.isListingGone,
  },
};

// Resolve a list of source ids (or null/empty = all registered) into adapters.
export function resolveSources(names) {
  const ids = names && names.length ? names : Object.keys(SOURCES);
  return ids.map(id => {
    const s = SOURCES[id];
    if (!s) throw new Error(`Unknown source "${id}". Known: ${Object.keys(SOURCES).join(', ')}`);
    return s;
  });
}
