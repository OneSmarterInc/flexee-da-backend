// The quarter reading (faculty, one per close): up to five sentences, each
// only when it applies, written from stored figures with fixed patterns.
// Pure: no database. It says what moved and what changed beside it, never
// "because", unless the engine recorded the link (an event's recorded effect).

import {
  REGION_KEYS,
  REGIONS,
  MODULE_NAMES,
  capital,
  joinList,
  plural,
  sentence,
  units,
} from './format';

type Regions = { r1: number; r2: number; r3: number };

export interface ReadingInput {
  quarter: number;
  /** Demand this quarter and last, per region; the season of this quarter. */
  demand: {
    current: Regions;
    previous: Regions | null;
    seasonalMultiplier: number;
  } | null;
  /** One entry per firm: its forecast and the actual demand per region. */
  forecasts: Array<{ forecast: Regions; actual: Regions }>;
  /** Events recorded this quarter, with how many firms each hit. */
  events: Array<{ name: string; effect: string; firms: number }>;
  close: { firms: number; submitted: number; carriedForward: number } | null;
  /** Modules that unlock in the next quarter. */
  opensNext: Array<{ moduleId: string; quarter: number }>;
}

const EVENT_PHRASE: Record<string, (firms: string) => string> = {
  PARTS_DELAYED: (f) => `delayed supplier orders for ${f}`,
  DEMAND_SPIKE: (f) => `raised demand for ${f}`,
  DEMAND_DROP: (f) => `lowered demand for ${f}`,
  COST_INCREASE: (f) => `raised material costs for ${f}`,
  STEAL_INPLAY: (f) => `moved customers between ${f}`,
};

export function demandSentence(d: ReadingInput['demand'], quarter: number) {
  if (!d) return null;
  const moves: string[] = [];
  REGION_KEYS.forEach((key, i) => {
    if (!d.previous) return;
    const from = Math.round(d.previous[key]);
    const to = Math.round(d.current[key]);
    if (from === to) return;
    moves.push(
      `${REGIONS[i]} ${to > from ? 'rose' : 'fell'} from ${units(from)} to ${units(to)} units`,
    );
  });
  const m = d.seasonalMultiplier;
  const season =
    m >= 1.1
      ? `Quarter ${quarter} is a peak season quarter`
      : m <= 0.95
        ? `Quarter ${quarter} is a low season quarter`
        : null;
  if (moves.length === 0 && !d.previous) {
    const list = REGION_KEYS.map(
      (k, i) => `${REGIONS[i]} ${units(d.current[k])}`,
    );
    return sentence(
      `Demand was ${joinList(list)} units${season ? `; ${season}` : ''}`,
    );
  }
  if (moves.length === 0)
    return season
      ? sentence(`Demand held level in every region; ${season}`)
      : null;
  return sentence(
    `Demand in ${moves.join('; ')}${season ? `; ${season}` : ''}`,
  );
}

export function forecastSentence(forecasts: ReadingInput['forecasts']) {
  if (forecasts.length === 0) return null;
  const parts: string[] = [];
  REGION_KEYS.forEach((key, i) => {
    let below = 0;
    let above = 0;
    for (const f of forecasts) {
      if (f.forecast[key] < f.actual[key]) below += 1;
      else if (f.forecast[key] > f.actual[key]) above += 1;
    }
    if (below === above) return;
    const [n, dir] = below > above ? [below, 'below'] : [above, 'above'];
    parts.push(
      `in ${REGIONS[i]}, ${n} of ${forecasts.length} firms forecast ${dir} actual demand`,
    );
  });
  return parts.length ? sentence(capital(parts.join('; '))) : null;
}

export function eventSentence(events: ReadingInput['events']) {
  const parts = events
    .filter((e) => e.firms > 0 && EVENT_PHRASE[e.effect])
    .map(
      (e) =>
        `The ${e.name.toLowerCase()} ${EVENT_PHRASE[e.effect](plural(e.firms, 'firm'))}`,
    );
  return parts.length ? sentence(capital(parts.join('; '))) : null;
}

export function submissionSentence(close: ReadingInput['close']) {
  if (!close) return null;
  if (close.carriedForward === 0)
    return sentence(`All ${plural(close.firms, 'firm')} submitted`);
  const carried =
    close.carriedForward === 1
      ? "1 firm's decisions were carried forward"
      : `the decisions of ${close.carriedForward} firms were carried forward`;
  return sentence(`${plural(close.submitted, 'firm')} submitted; ${carried}`);
}

export function nextSentence(opens: ReadingInput['opensNext']) {
  if (opens.length === 0) return null;
  const q = opens[0].quarter;
  const names = opens.map((m) => MODULE_NAMES[m.moduleId] ?? m.moduleId);
  return sentence(
    `${joinList(names)} ${names.length === 1 ? 'unlocks' : 'unlock'} in Quarter ${q}`,
  );
}

export function readingFor(input: ReadingInput): string {
  return [
    demandSentence(input.demand, input.quarter),
    forecastSentence(input.forecasts),
    eventSentence(input.events),
    submissionSentence(input.close),
    nextSentence(input.opensNext),
  ]
    .filter((s): s is string => Boolean(s))
    .join(' ');
}
