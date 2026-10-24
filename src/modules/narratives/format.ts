// Figures written the way the pages write them, so the reword check can
// compare them with the engine text as numbers.

export const usd = (n: number) =>
  `${n < 0 ? '-' : ''}$${Math.round(Math.abs(n)).toLocaleString('en-US')}`;
export const units = (n: number) => Math.round(n).toLocaleString('en-US');
export const one = (n: number) => (Math.round(n * 10) / 10).toFixed(1);
/** A 0-1 fraction as a percentage with one decimal. */
export const pct = (fraction: number) => `${one(fraction * 100)}%`;

export const plural = (
  n: number,
  singular: string,
  pluralForm = `${singular}s`,
) => `${n} ${n === 1 ? singular : pluralForm}`;

export const REGIONS = ['Region 1', 'Region 2', 'Region 3'] as const;
export const REGION_KEYS = ['r1', 'r2', 'r3'] as const;

export const MODULE_NAMES: Record<string, string> = {
  ds: 'Demand Science',
  sa: 'Supplier Analytics',
  ci: 'Customer Intelligence',
  nd: 'Network Design',
  pi: 'Product Innovation',
  me: 'Market Expansion',
};

export const sentence = (s: string) => (s.endsWith('.') ? s : `${s}.`);
export const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export function joinList(items: string[]) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}
