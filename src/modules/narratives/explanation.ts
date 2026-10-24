// The team explanation (students, one per firm per close): three to five
// sentences about one firm, from its own figures only. The largest moves
// against last quarter, by size relative to the measure's target, and what
// changed beside each one. Never another firm's figures, a rank or advice.
// Pure: no database.

import {
  REGION_KEYS,
  REGIONS,
  joinList,
  one,
  pct,
  sentence,
  units,
  usd,
} from './format';

type Regions = { r1: number; r2: number; r3: number };

export interface FirmFigures {
  revenue: number;
  netIncome: number;
  cash: number;
  fillRate: number;
  marketShare: number;
  csi: number;
}
export interface FirmDecision {
  productionP1: number;
  productionP2: number;
  priceP1: number;
  priceP2: number;
  marketingBudget: number;
}

export interface ExplanationInput {
  quarter: number;
  current: FirmFigures;
  previous: FirmFigures | null;
  decision: FirmDecision | null;
  previousDecision: FirmDecision | null;
  /** The decision for this quarter was last quarter's, copied. */
  carriedForward: boolean;
  /** This firm's forecast and the actual demand per region. */
  forecast: { forecast: Regions; actual: Regions } | null;
  /** Events with a recorded effect on this firm this quarter. */
  events: Array<{ name: string; effect: string; recorded?: number }>;
  /** Targets from CONFIG.scoring.BSC_THRESHOLDS. */
  targets: {
    revenue: number;
    netIncome: number;
    cash: number;
    fillRate: number;
    marketShare: number;
    csi: number;
  };
}

const MEASURES: Array<{
  key: keyof FirmFigures;
  label: string;
  show: (n: number) => string;
}> = [
  { key: 'revenue', label: 'revenue', show: usd },
  { key: 'netIncome', label: 'net income', show: usd },
  { key: 'cash', label: 'cash', show: usd },
  { key: 'fillRate', label: 'fill rate', show: pct },
  { key: 'marketShare', label: 'market share', show: pct },
  { key: 'csi', label: 'customer satisfaction', show: one },
];

/** Moves smaller than this share of the measure's target are not worth a sentence. */
export const MIN_MOVE = 0.02;

export function biggestMoves(input: ExplanationInput, limit = 3) {
  if (!input.previous) return [];
  const prev = input.previous;
  return MEASURES.map((m) => {
    const from = prev[m.key];
    const to = input.current[m.key];
    return { ...m, from, to, size: Math.abs(to - from) / input.targets[m.key] };
  })
    .filter((m) => m.size >= MIN_MOVE && m.from !== m.to)
    .sort((a, b) => b.size - a.size)
    .slice(0, limit);
}

function changeFacts(input: ExplanationInput): string[] {
  const d = input.decision;
  const p = input.previousDecision;
  const facts: string[] = [];
  if (d && p) {
    if (d.priceP1 !== p.priceP1)
      facts.push(
        `your P1 price went from ${usd(p.priceP1)} to ${usd(d.priceP1)}`,
      );
    if (d.priceP2 !== p.priceP2)
      facts.push(
        `your P2 price went from ${usd(p.priceP2)} to ${usd(d.priceP2)}`,
      );
    const prod = d.productionP1 + d.productionP2;
    const prevProd = p.productionP1 + p.productionP2;
    if (prod !== prevProd)
      facts.push(
        `your production plan went from ${units(prevProd)} to ${units(prod)} units`,
      );
    if (d.marketingBudget !== p.marketingBudget)
      facts.push(
        `your marketing budget went from ${usd(p.marketingBudget)} to ${usd(d.marketingBudget)}`,
      );
  }
  if (input.forecast) {
    let worst: { i: number; rel: number; below: boolean } | null = null;
    REGION_KEYS.forEach((k, i) => {
      const actual = input.forecast!.actual[k];
      if (actual <= 0) return;
      const err = input.forecast!.forecast[k] - actual;
      const rel = Math.abs(err) / actual;
      if (rel >= 0.05 && (!worst || rel > worst.rel))
        worst = { i, rel, below: err < 0 };
    });
    if (worst) {
      const w = worst as { i: number; below: boolean };
      facts.push(
        `your forecast for ${REGIONS[w.i]} was ${w.below ? 'below' : 'above'} actual demand`,
      );
    }
  }
  return facts.slice(0, 3);
}

const EVENT_RECORDED: Record<string, (name: string, n?: number) => string> = {
  PARTS_DELAYED: (name, n) =>
    `${name} delayed your supplier orders${n ? `; the engine recorded ${units(n)} parts delayed` : ''}`,
  DEMAND_SPIKE: (name) => `${name} raised demand for your firm`,
  DEMAND_DROP: (name) => `${name} lowered demand for your firm`,
  COST_INCREASE: (name) => `${name} raised your material costs`,
  STEAL_INPLAY: (name) => `${name} moved customers between firms`,
};

export function explanationFor(input: ExplanationInput): string {
  const out: string[] = [];
  if (input.carriedForward) {
    out.push(
      "Your team didn't submit this quarter, so last quarter's decisions were used.",
    );
  }
  if (!input.previous) {
    out.push(
      sentence(
        `This is your firm's first quarter of results: revenue was ${usd(input.current.revenue)} and net income was ${usd(input.current.netIncome)}`,
      ),
    );
  } else {
    const moves = biggestMoves(input);
    if (moves.length === 0) {
      out.push("Your results were close to last quarter's.");
    }
    for (const m of moves) {
      out.push(
        sentence(
          `Your ${m.label} ${m.to > m.from ? 'rose' : 'fell'} from ${m.show(m.from)} to ${m.show(m.to)}`,
        ),
      );
    }
  }
  if (!input.carriedForward) {
    const facts = changeFacts(input);
    if (facts.length)
      out.push(sentence(`In the same quarter, ${joinList(facts)}`));
  }
  for (const e of input.events) {
    const phrase = EVENT_RECORDED[e.effect];
    if (phrase)
      out.push(sentence(phrase(`The ${e.name.toLowerCase()}`, e.recorded)));
  }
  return out.join(' ');
}
