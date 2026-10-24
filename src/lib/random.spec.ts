import { readFileSync } from 'fs';
import { join } from 'path';
import { draw, newSeed, rngFor, withSeed } from './random';

describe('seeded random numbers', () => {
  const take = (g: () => number, n = 5) => Array.from({ length: n }, g);

  it('the same seed, quarter and stream give the same draws', () => {
    expect(take(rngFor(1, 4, 'demand'))).toEqual(take(rngFor(1, 4, 'demand')));
  });

  it('a different stream, quarter or seed gives different draws', () => {
    const base = take(rngFor(1, 4, 'demand'));
    expect(take(rngFor(1, 4, 'price'))).not.toEqual(base);
    expect(take(rngFor(1, 5, 'demand'))).not.toEqual(base);
    expect(take(rngFor(2, 4, 'demand'))).not.toEqual(base);
  });

  it('draws are in [0, 1)', () => {
    for (const v of take(rngFor(7, 4, 'supplier'), 1000)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('inside withSeed, draw follows the seeded stream; streams do not shift each other', () => {
    const alone = withSeed(1, 4, () => take(() => draw('demand')));
    const mixed = withSeed(1, 4, () => {
      draw('price');
      const a = draw('demand');
      draw('supplier');
      return [a, ...take(() => draw('demand'), 4)];
    });
    expect(mixed).toEqual(alone);
    expect(alone).toEqual(take(rngFor(1, 4, 'demand')));
  });

  it('survives awaits', async () => {
    const out = await withSeed(3, 4, async () => {
      const a = draw('demand');
      await new Promise((r) => setTimeout(r, 1));
      return [a, draw('demand')];
    });
    expect(out).toEqual(take(rngFor(3, 4, 'demand'), 2));
  });

  it('a new seed is a 32-bit integer', () => {
    const s = newSeed();
    expect(Number.isInteger(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThan(2 ** 32);
  });

  it('no Math.random( remains in simulation.service.ts', () => {
    const src = readFileSync(join(__dirname, '../modules/simulation/simulation.service.ts'), 'utf8');
    expect(src).not.toContain('Math.random(');
  });
});

describe('scopes', () => {
  it('two scopes of the same quarter draw different numbers; the same scope draws the same', () => {
    const a = withSeed(1, 4, () => [draw('prehistory'), draw('prehistory')], 'firm1');
    const b = withSeed(1, 4, () => [draw('prehistory'), draw('prehistory')], 'firm2');
    const a2 = withSeed(1, 4, () => [draw('prehistory'), draw('prehistory')], 'firm1');
    expect(a).not.toEqual(b);
    expect(a2).toEqual(a);
  });
});
