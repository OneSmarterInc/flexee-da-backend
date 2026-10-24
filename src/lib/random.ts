// Seeded random numbers (V3 Design E, D11). Each course stores a seed, so a
// quarter can be replayed with the same draws: golden tests need it, and a
// support replay matches production. Each use of randomness is its own named
// stream, so adding a draw in one place doesn't shift the others.

import { AsyncLocalStorage } from 'node:async_hooks';

/** mulberry32: a small seeded generator returning numbers in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A 32-bit hash of the course seed, the quarter and the stream's name. */
function mix(seed: number, quarter: number, stream: string): number {
  let h = 2166136261 ^ (seed >>> 0);
  for (const ch of `${quarter}:${stream}`) {
    h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  }
  return h >>> 0;
}

/** The generator for one stream of one quarter of one course. */
export function rngFor(seed: number, quarter: number, stream: string): () => number {
  return mulberry32(mix(seed, quarter, stream));
}

/** A random 32-bit seed for a new course. */
export function newSeed(): number {
  return Math.floor(Math.random() * 4294967296);
}

type Store = { seed: number; quarter: number; scope: string; streams: Map<string, () => number> };
const als = new AsyncLocalStorage<Store>();

/**
 * Run `fn` with this course's seed in force for the given quarter. A `scope`
 * (for example one firm) gives every stream inside it its own sequence, so
 * two scopes of the same quarter don't draw the same numbers.
 */
export function withSeed<T>(seed: number, quarter: number, fn: () => T, scope = ''): T {
  return als.run({ seed, quarter, scope, streams: new Map() }, fn);
}

/**
 * The next draw from a named stream. Inside withSeed it is the seeded
 * sequence for that quarter; outside it is an ordinary random number.
 */
export function draw(stream: string): number {
  const store = als.getStore();
  if (!store) return Math.random();
  const key = store.scope ? `${store.scope}:${stream}` : stream;
  let g = store.streams.get(key);
  if (!g) {
    g = rngFor(store.seed, store.quarter, key);
    store.streams.set(key, g);
  }
  return g();
}
