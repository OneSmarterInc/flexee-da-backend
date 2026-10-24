// Golden test (V3 Design E): the three reference firms play a standard-preset
// course from Quarter 4 to Quarter 11 with seed 1, and what each scores is
// pinned. An engine or config change that moves a figure fails this test; the
// PR that makes the change updates the pinned figures and says why.

import { INestApplication } from '@nestjs/common';
import { describeDb } from './mongo-test-db';
import { runReferenceCourse, startApp } from './helpers/reference-run';

const PINNED = {
  model_forecaster: {
    scores: { financial: 100, customer: 96.3, process: 91, learning: 80 },
    outcome: 'All four perspectives met',
    marketShare: 0.323,
    grossMargin: 57,
  },
  own_estimate_forecaster: {
    scores: { financial: 100, customer: 96.7, process: 90.1, learning: 54.2 },
    outcome: 'Three of four perspectives met',
    marketShare: 0.334,
    grossMargin: 56.5,
  },
  price_cutter: {
    scores: { financial: 100, customer: 96.3, process: 82.1, learning: 80 },
    outcome: 'All four perspectives met',
    marketShare: 0.343,
    grossMargin: 48.5,
  },
};

describeDb('golden: the reference paths on seed 1', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await startApp();
  }, 60_000);
  afterAll(async () => {
    await app.close();
  });

  it('plays quarters 4 to 11 and scores what is pinned', async () => {
    const run = await runReferenceCourse(app, 1);
    expect(run).toEqual(PINNED);
  }, 120_000);
});
