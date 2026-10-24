import { outcomeFor } from './outcome';
import { redactOtherOutcomes } from './outcome-redact';

const TOTAL = 11;

// Quarters 4..(3+n) with the given perspective scores.
function kpis(n: number, scores: [number, number, number, number]) {
  return Array.from({ length: n }, (_, i) => ({
    quarter: 4 + i,
    bsc: {
      financial: scores[0],
      customer: scores[1],
      process: scores[2],
      learning: scores[3],
    },
  }));
}

function decisions(n: number, how: (q: number) => string = () => 'team') {
  return Array.from({ length: n }, (_, i) => ({
    quarter: 4 + i,
    submittedHow: how(4 + i),
  }));
}

describe('outcomeFor', () => {
  it('meets all four', () => {
    const o = outcomeFor(kpis(4, [80, 75, 70, 90]), decisions(4), TOTAL);
    expect(o.label).toBe('All four perspectives met');
    expect(o.tests.every((t) => t.met)).toBe(true);
  });

  it('meets three', () => {
    const o = outcomeFor(kpis(4, [80, 75, 69, 90]), decisions(4), TOTAL);
    expect(o.label).toBe('Three of four perspectives met');
  });

  it('meets two', () => {
    const o = outcomeFor(kpis(4, [80, 75, 60, 60]), decisions(4), TOTAL);
    expect(o.label).toBe('Two of four perspectives met');
  });

  it('meets none', () => {
    const o = outcomeFor(kpis(4, [10, 20, 30, 40]), decisions(4), TOTAL);
    expect(o.label).toBe('Most perspectives missed');
  });

  it('meets one', () => {
    const o = outcomeFor(kpis(4, [90, 20, 30, 40]), decisions(4), TOTAL);
    expect(o.label).toBe('Most perspectives missed');
  });

  it('is not Incomplete at exactly half missed', () => {
    const o = outcomeFor(
      kpis(4, [80, 80, 80, 80]),
      decisions(4, (q) => (q <= 5 ? 'carried_forward' : 'team')),
      TOTAL,
    );
    expect(o.missed).toBe(2);
    expect(o.label).toBe('All four perspectives met');
  });

  it('is Incomplete when over half are missed', () => {
    const o = outcomeFor(
      kpis(4, [80, 80, 60, 60]),
      decisions(4, (q) => (q <= 6 ? 'baseline' : 'team')),
      TOTAL,
    );
    expect(o.label).toBe('Incomplete');
    expect(o.lines[0]).toBe(
      "Your team didn't submit 3 of 4 quarters, so last quarter's decisions were used in those quarters. Over the quarters you played, you met 2 of 4 perspectives.",
    );
  });

  it('counts a promoted draft as played', () => {
    const o = outcomeFor(
      kpis(4, [80, 80, 80, 80]),
      decisions(4, () => 'draft_promoted'),
      TOTAL,
    );
    expect(o.missed).toBe(0);
    expect(o.label).toBe('All four perspectives met');
  });

  it('treats old decisions with no submittedHow as submitted', () => {
    const o = outcomeFor(
      kpis(2, [80, 80, 80, 80]),
      [{ quarter: 4 }, { quarter: 5, submittedHow: undefined }],
      TOTAL,
    );
    expect(o.missed).toBe(0);
  });

  it('gives no outcome while only warm-up quarters are closed', () => {
    const warmup = [1, 2, 3].map((quarter) => ({
      quarter,
      bsc: { financial: 90, customer: 90, process: 90, learning: 90 },
    }));
    const o = outcomeFor(
      warmup,
      [1, 2, 3].map((quarter) => ({
        quarter,
        submittedHow: 'carried_forward',
      })),
      TOTAL,
    );
    expect(o.label).toBeNull();
    expect(o.played).toBe(0);
  });

  it('ignores warm-up quarters in the averages and the missed count', () => {
    const rows = [
      {
        quarter: 1,
        bsc: { financial: 0, customer: 0, process: 0, learning: 0 },
      },
      ...kpis(1, [80, 80, 80, 80]),
    ];
    const o = outcomeFor(
      rows,
      [{ quarter: 1, submittedHow: 'baseline' }, ...decisions(1)],
      TOTAL,
    );
    expect(o.tests[0].average).toBe(80);
    expect(o.missed).toBe(0);
  });

  it('writes one line per test with the figure', () => {
    const o = outcomeFor(kpis(2, [76, 64, 70, 90]), decisions(2), TOTAL);
    expect(o.lines).toEqual([
      'Financial: your average was 76, above the 70 needed.',
      'Customer: your average was 64, below the 70 needed.',
      'Process: your average was 70, at the 70 needed.',
      'Learning: your average was 90, above the 70 needed.',
    ]);
  });

  it('shows one decimal when rounding would hide where the average sits against the bar', () => {
    const below = outcomeFor(
      kpis(2, [69.6, 70.3, 70, 90]),
      decisions(2),
      TOTAL,
    );
    expect(below.lines[0]).toBe(
      'Financial: your average was 69.6, below the 70 needed.',
    );
    expect(below.lines[1]).toBe(
      'Customer: your average was 70.3, above the 70 needed.',
    );
    expect(below.lines[2]).toBe(
      'Process: your average was 70, at the 70 needed.',
    );
  });
});

describe('redactOtherOutcomes', () => {
  const rows = [
    { firmId: 'a', outcome: { label: 'x' } },
    { firmId: 'b', outcome: { label: 'y' } },
  ];
  it("keeps the student's own outcome and nulls the others'", () => {
    const out = redactOtherOutcomes(rows, 'a', (r) => r.firmId);
    expect(out[0].outcome).toEqual({ label: 'x' });
    expect(out[1].outcome).toBeNull();
  });
  it('nulls every outcome for a student with no firm', () => {
    expect(
      redactOtherOutcomes(rows, null, (r) => r.firmId).every(
        (r) => r.outcome === null,
      ),
    ).toBe(true);
  });
});
