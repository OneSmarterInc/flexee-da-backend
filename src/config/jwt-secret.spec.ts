import { jwtSecret } from './jwt-secret';

describe('JWT secret', () => {
  it('refuses to run without one', () => {
    expect(() => jwtSecret({})).toThrow(/JWT_SECRET is not set/);
    expect(() => jwtSecret({ JWT_SECRET: '   ' })).toThrow(/not set/);
  });

  it('refuses the old fallback and other placeholders', () => {
    expect(() => jwtSecret({ JWT_SECRET: 'your-secret-key' })).toThrow(
      /placeholder/,
    );
    expect(() => jwtSecret({ JWT_SECRET: 'Secret' })).toThrow(/placeholder/);
  });

  it('accepts a real secret', () => {
    const s = 'x'.repeat(48);
    expect(jwtSecret({ JWT_SECRET: s })).toBe(s);
  });
});
