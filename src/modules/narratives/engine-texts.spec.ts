import {
  demandCaption,
  accuracyCaption,
  forecastStory,
  scorecardCaption,
} from './debrief';
import { explanationFor, type ExplanationInput } from './explanation';
import { readingFor, type ReadingInput } from './reading';

const base: ReadingInput = {
  quarter: 7,
  demand: {
    current: { r1: 30000, r2: 14100, r3: 9000 },
    previous: { r1: 30000, r2: 12400, r3: 9500 },
    seasonalMultiplier: 1.25,
  },
  forecasts: [
    {
      forecast: { r1: 30000, r2: 12000, r3: 9000 },
      actual: { r1: 30000, r2: 14100, r3: 9000 },
    },
    {
      forecast: { r1: 30000, r2: 13000, r3: 9000 },
      actual: { r1: 30000, r2: 14100, r3: 9000 },
    },
    {
      forecast: { r1: 30000, r2: 15000, r3: 9000 },
      actual: { r1: 30000, r2: 14100, r3: 9000 },
    },
  ],
  events: [{ name: 'Port Strike', effect: 'PARTS_DELAYED', firms: 4 }],
  close: { firms: 5, submitted: 4, carriedForward: 1 },
  opensNext: [{ moduleId: 'sa', quarter: 8 }],
};

describe('the quarter reading', () => {
  it('writes every sentence, with rising and falling demand', () => {
    const text = readingFor(base);
    expect(text).toBe(
      'Demand in Region 2 rose from 12,400 to 14,100 units; Region 3 fell from 9,500 to 9,000 units; Quarter 7 is a peak season quarter. ' +
        'In Region 2, 2 of 3 firms forecast below actual demand. ' +
        'The port strike delayed supplier orders for 4 firms. ' +
        "4 firms submitted; 1 firm's decisions were carried forward. " +
        'Supplier Analytics unlocks in Quarter 8.',
    );
  });

  it('leaves out events when there are none, and the carry-forward when all submitted', () => {
    const text = readingFor({
      ...base,
      events: [],
      close: { firms: 5, submitted: 5, carriedForward: 0 },
    });
    expect(text).not.toContain('strike');
    expect(text).toContain('All 5 firms submitted.');
  });

  it('writes the module line only when one unlocks next', () => {
    expect(readingFor({ ...base, opensNext: [] })).not.toContain('unlock');
    expect(
      readingFor({
        ...base,
        opensNext: [
          { moduleId: 'sa', quarter: 8 },
          { moduleId: 'ci', quarter: 8 },
        ],
      }),
    ).toContain(
      'Supplier Analytics and Customer Intelligence unlock in Quarter 8.',
    );
  });

  it('writes counts as digits, never words', () => {
    expect(readingFor(base)).not.toMatch(/\b(?:one|two|three|four|five)\b/i);
  });
});

const figs = {
  revenue: 70_000_000,
  netIncome: 5_000_000,
  cash: 20_000_000,
  fillRate: 0.95,
  marketShare: 0.35,
  csi: 85,
};
const targets = {
  revenue: 70_000_000,
  netIncome: 5_000_000,
  cash: 20_000_000,
  fillRate: 0.95,
  marketShare: 0.35,
  csi: 85,
};
const dec = {
  productionP1: 120000,
  productionP2: 80000,
  priceP1: 500,
  priceP2: 850,
  marketingBudget: 5_000_000,
};
const explanation: ExplanationInput = {
  quarter: 7,
  current: { ...figs, fillRate: 0.885, cash: 21_000_000 },
  previous: { ...figs, fillRate: 0.96 },
  decision: { ...dec, productionP1: 100000, priceP1: 520 },
  previousDecision: dec,
  carriedForward: false,
  forecast: {
    forecast: { r1: 1, r2: 10000, r3: 1 },
    actual: { r1: 1, r2: 14000, r3: 1 },
  },
  events: [{ name: 'Port Strike', effect: 'PARTS_DELAYED', recorded: 4200 }],
  targets,
};

describe('the team explanation', () => {
  it('names the biggest move, what changed beside it, and an event with its recorded effect', () => {
    const text = explanationFor(explanation);
    expect(text).toContain('Your fill rate fell from 96.0% to 88.5%.');
    expect(text).toContain(
      'In the same quarter, your P1 price went from $500 to $520, your production plan went from 200,000 to 180,000 units and your forecast for Region 2 was below actual demand.',
    );
    expect(text).toContain(
      'The port strike delayed your supplier orders; the engine recorded 4,200 parts delayed.',
    );
    expect(text).not.toMatch(/because|should|rank|better/i);
  });

  it('says so when the quarter was carried forward, and leaves out decision changes', () => {
    const text = explanationFor({ ...explanation, carriedForward: true });
    expect(
      text.startsWith(
        "Your team didn't submit this quarter, so last quarter's decisions were used.",
      ),
    ).toBe(true);
    expect(text).not.toContain('In the same quarter');
  });

  it('writes a first quarter with no earlier figures', () => {
    expect(
      explanationFor({ ...explanation, previous: null, events: [] }),
    ).toContain('first quarter of results');
  });

  it('never names another firm or ranks', () => {
    const text = explanationFor(explanation);
    expect(text).not.toMatch(/Firm \d|rank/);
  });
});

describe('the debrief texts', () => {
  it('captions each chart from its own data', () => {
    expect(
      accuracyCaption('Firm 3', [
        { quarter: 6, value: 0.71 },
        { quarter: 11, value: 0.88 },
      ]),
    ).toBe(
      "Firm 3's forecast accuracy rose from 71.0% in Quarter 6 to 88.0% in Quarter 11.",
    );
    expect(
      scorecardCaption('Firm 3', [
        { quarter: 4, value: 66 },
        { quarter: 11, value: 74.5 },
      ]),
    ).toBe(
      "Firm 3's scorecard overall rose from 66.0 in Quarter 4 to 74.5 in Quarter 11.",
    );
    expect(
      demandCaption([
        { quarter: 4, value: 100000 },
        { quarter: 5, value: 130000 },
        { quarter: 6, value: 120000 },
      ]),
    ).toBe(
      'Total demand moved from 100,000 units in Quarter 4 to 120,000 units in Quarter 6; the highest quarter was Quarter 5 at 130,000 units.',
    );
  });

  it('averages accuracy by own estimate and by model, for each firm and the course, in student quarters only', () => {
    const story = forecastStory([
      { firmId: 'a', quarter: 2, accuracy: 0.1, source: 'BASELINE' },
      { firmId: 'a', quarter: 4, accuracy: 0.7, source: 'GUT' },
      { firmId: 'a', quarter: 5, accuracy: 0.9, source: 'MODEL' },
      { firmId: 'b', quarter: 4, accuracy: 0.8, source: 'GUT' },
    ]);
    expect(story.firms.a.ownEstimate).toEqual({ quarters: 1, average: 0.7 });
    expect(story.firms.a.model).toEqual({ quarters: 1, average: 0.9 });
    expect(story.course.ownEstimate.average).toBeCloseTo(0.75, 6);
    expect(story.course.model.average).toBe(0.9);
  });
});
