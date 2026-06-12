/**
 * A Map whose entries expire after going unused — the transcript layer's
 * session caches grow with every session ever watched; sweeping the ones the
 * fleet stopped touching keeps a long-running dashboard bounded. A swept
 * session that reappears just pays its cold parse again.
 */
export class SessionCache<K, V> {
  private m = new Map<K, { v: V; at: number }>()
  private lastSweep = 0

  constructor(
    private maxAgeMs = 5 * 60_000,
    private sweepEveryMs = 60_000,
  ) {}

  get(k: K, now: number): V | undefined {
    const e = this.m.get(k)
    if (!e) return undefined
    e.at = now
    return e.v
  }

  set(k: K, v: V, now: number): void {
    this.m.set(k, { v, at: now })
    this.sweep(now)
  }

  private sweep(now: number): void {
    if (now - this.lastSweep < this.sweepEveryMs) return
    this.lastSweep = now
    for (const [k, e] of this.m) if (now - e.at > this.maxAgeMs) this.m.delete(k)
  }

  get size(): number {
    return this.m.size
  }
}
