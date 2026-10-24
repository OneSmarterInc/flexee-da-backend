export const OUTCOME_BAR = 70;
export const WARMUP_QUARTERS = 3;
export const INCOMPLETE_SHARE = 0.5;

export type SubmittedHow =
  | 'team'
  | 'draft_promoted'
  | 'carried_forward'
  | 'baseline';

const MISSED_HOW: ReadonlySet<string> = new Set(['carried_forward', 'baseline']);

const TESTS = [
  { key: 'financial', name: 'Financial' },
  { key: 'customer', name: 'Customer' },
  { key: 'process', name: 'Process' },
  { key: 'learning', name: 'Learning' },
] as const;

export interface OutcomeKpi {
  quarter: number;
  bsc?: Partial<Record<(typeof TESTS)[number]['key'], number | null>> | null;
}

export interface OutcomeDecision {
  quarter: number;
  submittedHow?: string | null;
}

export interface OutcomeTest {
  key: string;
  met: boolean;
  average: number | null;
  needed: number;
}

export interface Outcome {
  label: string | null;
  incomplete: boolean;
  tests: OutcomeTest[];
  missed: number;
  played: number;
  lines: string[];
}

const LABELS: Record<number, string> = {
  4: 'All four perspectives met',
  3: 'Three of four perspectives met',
  2: 'Two of four perspectives met',
  1: 'Most perspectives missed',
  0: 'Most perspectives missed',
};

export function isMissed(submittedHow?: string | null): boolean {
  return MISSED_HOW.has(submittedHow ?? 'team');
}

export function outcomeFor(
  kpis: OutcomeKpi[],
  decisions: OutcomeDecision[],
  totalQuarters: number,
): Outcome {
  const inPlay = (q: number) => q > WARMUP_QUARTERS && q <= totalQuarters;
  const playedKpis = kpis.filter((k) => inPlay(k.quarter));
  const playedQuarters = new Set(playedKpis.map((k) => k.quarter));
  const played = playedQuarters.size;

  if (played === 0) {
    return { label: null, incomplete: false, tests: [], missed: 0, played: 0, lines: [] };
  }

  const missedQuarters = new Set(
    decisions
      .filter((d) => playedQuarters.has(d.quarter) && isMissed(d.submittedHow))
      .map((d) => d.quarter),
  );
  const missed = missedQuarters.size;

  const tests: OutcomeTest[] = TESTS.map(({ key }) => {
    const values = playedKpis
      .map((k) => k.bsc?.[key])
      .filter((v): v is number => typeof v === 'number');
    const average = values.length
      ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
      : null;
    return { key, met: average !== null && average >= OUTCOME_BAR, average, needed: OUTCOME_BAR };
  });
  const metCount = tests.filter((t) => t.met).length;

  const testLines = tests.map((t, i) => {
    const name = TESTS[i].name;
    if (t.average === null) return `${name}: no figures yet.`;
    const avg = Math.round(t.average);
    const rel =
      t.average > OUTCOME_BAR ? 'above' : t.average === OUTCOME_BAR ? 'at' : 'below';
    return `${name}: your average was ${avg}, ${rel} the ${OUTCOME_BAR} needed.`;
  });

  const incomplete = missed / played > INCOMPLETE_SHARE;
  if (incomplete) {
    return {
      label: 'Incomplete',
      incomplete,
      tests,
      missed,
      played,
      lines: [
        `Your team didn't submit ${missed} of ${played} quarters, so last quarter's decisions were used in those quarters. Over the quarters you played, you met ${metCount} of 4 perspectives.`,
        ...testLines,
      ],
    };
  }

  return { label: LABELS[metCount], incomplete, tests, missed, played, lines: testLines };
}
