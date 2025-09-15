import { idbGet, idbSet, idbDel } from './db';

// Generic TTL wrapper on top of a KV store
// Stored value shape: { ts: number, ttl: number, value: any }

export async function cacheGet(key) {
  try {
    const wrapped = await idbGet(key);
    return wrapped || null;
  } catch (e) {
    console.warn('cacheGet failed', e);
    return null;
  }
}

// Return raw entry with metadata { ts, ttl, value }
export async function cacheGetEntry(key) {
  return cacheGet(key);
}

export async function cacheSet(key, value, ttlMs) {
  try {
    const wrapped = { ts: Date.now(), ttl: ttlMs || 0, value };
    await idbSet(key, wrapped);
  } catch (e) {
    console.warn('cacheSet failed', e);
  }
}

export function isFresh(entry) {
  if (!entry) return false;
  if (!entry.ttl) return true; // treat 0 as no-expiry
  return Date.now() - entry.ts < entry.ttl;
}

export async function getWithTTL(key) {
  const entry = await cacheGet(key);
  if (entry && isFresh(entry)) return entry.value;
  return null;
}

export async function setWithTTL(key, value, ttlMs) {
  await cacheSet(key, value, ttlMs);
}

export async function cacheInvalidate(key) {
  try { await idbDel(key); } catch (e) { /* ignore */ }
}
