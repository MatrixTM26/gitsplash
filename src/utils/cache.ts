import { promises as fs } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

interface CacheEntry<T> {
  data: T;
  fetchedAt: string;
  expiresAt: string;
  key: string;
}

// ============================================================
// File-based JSON Cache
// ============================================================
export class FileCache {
  private dir: string;
  private ttlMinutes: number;

  constructor(dir = '.cache', ttlMinutes = 60) {
    this.dir = dir;
    this.ttlMinutes = ttlMinutes;
  }

  async init(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
  }

  private keyToPath(key: string): string {
    const hash = createHash('sha256')
      .update(key)
      .digest('hex')
      .slice(0, 16);
    const safe = key.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32);
    return join(this.dir, `${safe}_${hash}.json`);
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await fs.readFile(this.keyToPath(key), 'utf-8');
      const entry: CacheEntry<T> = JSON.parse(raw);

      if (new Date(entry.expiresAt) < new Date()) {
        console.log(`[Cache] EXPIRED: ${key}`);
        return null;
      }

      console.log(`[Cache] HIT: ${key}`);
      return entry.data;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, data: T, ttlOverride?: number): Promise<void> {
    const ttl = ttlOverride ?? this.ttlMinutes;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttl * 60 * 1000);

    const entry: CacheEntry<T> = {
      data,
      fetchedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      key,
    };

    await fs.writeFile(this.keyToPath(key), JSON.stringify(entry, null, 2));
    console.log(`[Cache] SET: ${key} (TTL: ${ttl}m)`);
  }

  async invalidate(key: string): Promise<void> {
    try {
      await fs.unlink(this.keyToPath(key));
    } catch {
      // File might not exist
    }
  }

  async invalidateAll(): Promise<void> {
    try {
      const files = await fs.readdir(this.dir);
      for (const f of files) {
        if (f.endsWith('.json')) {
          await fs.unlink(join(this.dir, f));
        }
      }
      console.log('[Cache] Cleared all cache entries');
    } catch {
      // Dir might not exist
    }
  }

  async stats(): Promise<{ entries: number; totalBytes: number }> {
    try {
      const files = await fs.readdir(this.dir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));
      let totalBytes = 0;
      for (const f of jsonFiles) {
        const stat = await fs.stat(join(this.dir, f));
        totalBytes += stat.size;
      }
      return { entries: jsonFiles.length, totalBytes };
    } catch {
      return { entries: 0, totalBytes: 0 };
    }
  }
}

// ============================================================
// Cached wrapper for async functions
// ============================================================
export function withCache<T>(
  cache: FileCache,
  key: string,
  fn: () => Promise<T>,
  ttlMinutes?: number
): Promise<T> {
  return (async () => {
    const cached = await cache.get<T>(key);
    if (cached !== null) return cached;

    console.log(`[Cache] MISS: ${key} — fetching...`);
    const data = await fn();
    await cache.set(key, data, ttlMinutes);
    return data;
  })();
}
