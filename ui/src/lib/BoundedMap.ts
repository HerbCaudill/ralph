/**
 * A Map with a maximum capacity that evicts the oldest entries (by insertion order)
 * when the limit is exceeded. Uses the built-in Map's insertion-order iteration.
 *
 * This prevents unbounded memory growth in long-running sessions where Maps
 * accumulate entries over time (e.g., per-instance tracking maps).
 */
export class BoundedMap<K, V> extends Map<K, V> {
  readonly maxSize: number

  constructor(maxSize: number, entries?: Iterable<[K, V]>) {
    super(entries)
    this.maxSize = maxSize
    this.evict()
  }

  override set(key: K, value: V): this {
    // If key already exists, delete first so it moves to the end (most recent)
    if (this.has(key)) {
      this.delete(key)
    }
    super.set(key, value)
    this.evict()
    return this
  }

  private evict(): void {
    while (this.size > this.maxSize) {
      // Map iterates in insertion order; first key is the oldest
      const oldest = this.keys().next().value
      if (oldest !== undefined) {
        this.delete(oldest)
      } else {
        break
      }
    }
  }
}
