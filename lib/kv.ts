import 'server-only'
import { env } from '@/lib/config/env'

/**
 * Minimal key/value store used for subscription state and free-tier quotas.
 *
 * Two backends:
 *  - Upstash Redis over its REST API when UPSTASH_REDIS_REST_URL is set. No SDK
 *    dependency: the REST API is plain fetch, which also keeps it edge-safe.
 *  - An in-process Map otherwise, so `pnpm dev` works with zero setup.
 *
 * The Map backend does NOT survive a restart and is not shared between
 * serverless instances — production deployments must set the Upstash vars.
 */
export interface Kv {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>
  delete(key: string): Promise<void>
  /** Increments a counter and returns the new value; sets the TTL on creation. */
  increment(key: string, ttlSeconds: number): Promise<number>
  /** Decrements a counter without letting it fall below zero. */
  decrement(key: string): Promise<number>
  /** Adds a member to a set; returns true if it was not there before. */
  setAdd(key: string, member: string): Promise<boolean>
  setRemove(key: string, member: string): Promise<void>
  setMembers(key: string): Promise<string[]>
}

interface MemoryEntry {
  value: unknown
  expiresAt: number | null
}

function createMemoryKv(): Kv {
  // Survives HMR in dev by living on globalThis.
  const globalStore = globalThis as typeof globalThis & {
    __tarosKv?: Map<string, MemoryEntry>
  }
  const store = (globalStore.__tarosKv ??= new Map<string, MemoryEntry>())

  const read = (key: string): MemoryEntry | null => {
    const entry = store.get(key)
    if (!entry) return null
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      store.delete(key)
      return null
    }
    return entry
  }

  return {
    async get<T>(key: string) {
      return (read(key)?.value as T | undefined) ?? null
    },
    async set<T>(key: string, value: T, ttlSeconds?: number) {
      store.set(key, {
        value,
        expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
      })
    },
    async delete(key: string) {
      store.delete(key)
    },
    async increment(key: string, ttlSeconds: number) {
      const existing = read(key)
      const next = (typeof existing?.value === 'number' ? existing.value : 0) + 1
      store.set(key, {
        value: next,
        // Keep the original window: only a fresh counter starts a new TTL.
        expiresAt: existing?.expiresAt ?? Date.now() + ttlSeconds * 1000,
      })
      return next
    },
    async decrement(key: string) {
      const existing = read(key)
      if (!existing || typeof existing.value !== 'number') return 0
      const next = Math.max(0, existing.value - 1)
      store.set(key, { value: next, expiresAt: existing.expiresAt })
      return next
    },
    async setAdd(key: string, member: string) {
      const existing = read(key)
      const members = new Set<string>(Array.isArray(existing?.value) ? (existing.value as string[]) : [])
      const added = !members.has(member)
      members.add(member)
      store.set(key, { value: [...members], expiresAt: existing?.expiresAt ?? null })
      return added
    },
    async setRemove(key: string, member: string) {
      const existing = read(key)
      if (!existing || !Array.isArray(existing.value)) return
      store.set(key, {
        value: (existing.value as string[]).filter(m => m !== member),
        expiresAt: existing.expiresAt,
      })
    },
    async setMembers(key: string) {
      const existing = read(key)
      return Array.isArray(existing?.value) ? [...(existing.value as string[])] : []
    },
  }
}

const INCREMENT_SCRIPT = `
local next = redis.call('INCR', KEYS[1])
if next == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return next`

function createUpstashKv(url: string, token: string): Kv {
  async function command<T>(body: unknown[]): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    if (!response.ok) {
      throw new Error(`Upstash request failed: ${response.status} ${await response.text()}`)
    }
    const payload = (await response.json()) as { result: T }
    return payload.result
  }

  return {
    async get<T>(key: string) {
      const raw = await command<string | null>(['GET', key])
      if (raw === null || raw === undefined) return null
      try {
        return JSON.parse(raw) as T
      } catch {
        return raw as unknown as T
      }
    },
    async set<T>(key: string, value: T, ttlSeconds?: number) {
      const args: unknown[] = ['SET', key, JSON.stringify(value)]
      if (ttlSeconds) args.push('EX', ttlSeconds)
      await command(args)
    },
    async delete(key: string) {
      await command(['DEL', key])
    },
    async increment(key: string, ttlSeconds: number) {
      // One script so INCR and EXPIRE are atomic: as two requests, a failure
      // between them left a counter with no TTL and the visitor blocked forever.
      // Only the first write in the window sets an expiry.
      return command<number>(['EVAL', INCREMENT_SCRIPT, 1, key, ttlSeconds])
    },
    async decrement(key: string) {
      const next = await command<number>(['DECR', key])
      if (next < 0) {
        await command(['SET', key, '0', 'KEEPTTL'])
        return 0
      }
      return next
    },
    async setAdd(key: string, member: string) {
      return (await command<number>(['SADD', key, member])) === 1
    },
    async setRemove(key: string, member: string) {
      await command(['SREM', key, member])
    },
    async setMembers(key: string) {
      return (await command<string[] | null>(['SMEMBERS', key])) ?? []
    },
  }
}

let cached: Kv | null = null

export function getKv(): Kv {
  if (cached) return cached
  const url = env.upstashRedisUrl
  const token = env.upstashRedisToken
  if (url && token) {
    cached = createUpstashKv(url, token)
  } else {
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[taros] UPSTASH_REDIS_REST_URL is not set — falling back to in-memory storage. ' +
          'Quotas will not be shared between instances, and checkout stays disabled ' +
          '(see isStripeConfigured).',
      )
    }
    cached = createMemoryKv()
  }
  return cached
}
