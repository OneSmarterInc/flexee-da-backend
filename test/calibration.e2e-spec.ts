// Calibration (V3 Design E): the reference paths still separate as intended,
// checked by order rather than exact figure, on seeds 1 to 4.

import { INestApplication } from '@nestjs/common';
import { describeDb } from './mongo-test-db';
import { runReferenceCourse, startApp } from './helpers/reference-run';

describeDb('calibration: the reference paths separate on every seed', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await startApp();
  }, 60_000);
  afterAll(async () => {
    await app.close();
  });

  async function checkOrders(seed: number) {
    const r = await runReferenceCourse(app, seed);
    const model = r.model_forecaster;
    const own = r.own_estimate_forecaster;
    const cutter = r.price_cutter;
    // Forecasting with the model learns better than forecasting by hand.
    expect(model.scores.learning).toBeGreaterThan(own.scores.learning);
    // Cutting price wins share and gives up margin.
    expect(cutter.marketShare).toBeGreaterThan(model.marketShare);
    expect(cutter.marketShare).toBeGreaterThan(own.marketShare);
    expect(cutter.grossMargin).toBeLessThan(model.grossMargin);
    expect(cutter.grossMargin).toBeLessThan(own.grossMargin);
  }

  it.each([1, 2, 3, 4])('seed %i', checkOrders, 120_000);
});
