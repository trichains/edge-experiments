/**
 * FNV-1a 32-bit over the UTF-8 bytes of the input.
 * Reference vectors: http://www.isthe.com/chongo/tech/comp/fnv/ (fnv1a32("") = 0x811c9dc5).
 */
export function fnv1a32(input: string): number {
  const bytes = new TextEncoder().encode(input);
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    // hash *= 16777619, kept in 32 bits
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * murmur3 32-bit finalizer ("fmix32"). FNV-1a alone has weak avalanche on inputs that
 * only differ in the last characters (e.g. "...:exp-a" vs "...:exp-b"), so the bucket
 * value is passed through this mixer to spread the bits.
 */
export function fmix32(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Deterministic hash of a string into [0, 1). */
export function hashToUnit(input: string): number {
  return fmix32(fnv1a32(input)) / 0x1_0000_0000;
}
