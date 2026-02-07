type RateEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateEntry>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (entry.count >= limit) {
    return { ok: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  store.set(key, entry);
  return { ok: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}
