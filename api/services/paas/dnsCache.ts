import dns from 'dns/promises';

interface CacheEntry {
  value: string[][];
  expiresAt: number;
}

const CACHE_TTL_MS = Number(process.env.PAAS_DNS_CACHE_TTL_MS || 5 * 60 * 1000);
const cache = new Map<string, CacheEntry>();

export class DnsCache {
  static async resolveTxt(recordName: string): Promise<string[][]> {
    const key = recordName.toLowerCase();
    const entry = cache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.value;
    }

    const records = await dns.resolveTxt(recordName);
    cache.set(key, {
      value: records,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return records;
  }

  static invalidate(recordName?: string): void {
    if (recordName) {
      cache.delete(recordName.toLowerCase());
      return;
    }
    cache.clear();
  }
}
