/**
 * Seeded Pseudo-Random Number Generator (Mulberry32).
 * Guarantees 100% deterministic, platform-independent random number sequence.
 */
export class SeededPRNG {
  private s: number;

  constructor(seed: number) {
    this.s = Math.floor(seed) >>> 0;
    if (this.s === 0) this.s = 123456789;
  }

  /** Returns pseudo-random float in [0, 1) */
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns pseudo-random integer in [min, max] inclusive */
  nextInt(min: number, max: number): number {
    const r = this.next();
    return Math.floor(r * (max - min + 1)) + min;
  }

  /** Shuffles array in-place deterministically */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}
