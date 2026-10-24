// The debrief's engine texts and the forecast story. Pure: no database.

import { one, pct, sentence, units } from './format';

export interface Point {
  quarter: number;
  value: number;
}

const avg = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

/** "Firm 3's forecast accuracy rose from 71.0% in Quarter 6 to 88.0% in Quarter 11." */
export function accuracyCaption(firm: string, points: Point[]) {
  if (points.length < 2) return null;
  const a = points[0];
  const b = points[points.length - 1];
  if (a.value === b.value) {
    return sentence(
      `${firm}'s forecast accuracy stayed at ${pct(a.value)} from Quarter ${a.quarter} to Quarter ${b.quarter}`,
    );
  }
  return sentence(
    `${firm}'s forecast accuracy ${b.value > a.value ? 'rose' : 'fell'} from ${pct(a.value)} in Quarter ${a.quarter} to ${pct(b.value)} in Quarter ${b.quarter}`,
  );
}

/** "Firm 3's scorecard overall rose from 66.0 in Quarter 4 to 74.5 in Quarter 11." */
export function scorecardCaption(firm: string, points: Point[]) {
  if (points.length < 2) return null;
  const a = points[0];
  const b = points[points.length - 1];
  if (a.value === b.value) {
    return sentence(
      `${firm}'s scorecard overall stayed at ${one(a.value)} from Quarter ${a.quarter} to Quarter ${b.quarter}`,
    );
  }
  return sentence(
    `${firm}'s scorecard overall ${b.value > a.value ? 'rose' : 'fell'} from ${one(a.value)} in Quarter ${a.quarter} to ${one(b.value)} in Quarter ${b.quarter}`,
  );
}

/** Total demand over the student quarters. */
export function demandCaption(points: Point[]) {
  if (points.length < 2) return null;
  const a = points[0];
  const b = points[points.length - 1];
  const high = points.reduce((m, p) => (p.value > m.value ? p : m), points[0]);
  return sentence(
    `Total demand moved from ${units(a.value)} units in Quarter ${a.quarter} to ${units(b.value)} units in Quarter ${b.quarter}; the highest quarter was Quarter ${high.quarter} at ${units(high.value)} units`,
  );
}

export interface ForecastRow {
  firmId: string;
  quarter: number;
  accuracy: number;
  /** GUT is the team's own estimate, MODEL a forecasting model, BASELINE last quarter's figures. */
  source: string;
}

/**
 * Per firm, and for the course, the average accuracy in the quarters a firm
 * used its own estimate and in the quarters it used a model. Only the student
 * quarters (Quarter 4 on) with a real choice count; baseline rows do not.
 */
export function forecastStory(rows: ForecastRow[], firstStudentQuarter = 4) {
  const used = rows.filter(
    (r) =>
      r.quarter >= firstStudentQuarter &&
      (r.source === 'GUT' || r.source === 'MODEL'),
  );
  const group = (list: ForecastRow[]) => {
    const own = list.filter((r) => r.source === 'GUT');
    const model = list.filter((r) => r.source === 'MODEL');
    return {
      ownEstimate: {
        quarters: own.length,
        average: avg(own.map((r) => r.accuracy)),
      },
      model: {
        quarters: model.length,
        average: avg(model.map((r) => r.accuracy)),
      },
    };
  };
  const byFirm = new Map<string, ForecastRow[]>();
  for (const r of used)
    byFirm.set(r.firmId, [...(byFirm.get(r.firmId) ?? []), r]);
  return {
    course: group(used),
    firms: Object.fromEntries(
      [...byFirm].map(([id, list]) => [id, group(list)]),
    ),
  };
}
