/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument -- the service is built with only the models it uses */
import { Connection, Model, Types } from 'mongoose';
import {
  clearTestDb,
  closeTestDb,
  connectTestDb,
  describeDb,
} from '../../../test/mongo-test-db';
import {
  Decision,
  DecisionSchema,
  DemandHistory,
  DemandHistorySchema,
  Firm,
  FirmSchema,
  QuarterState,
  QuarterStateSchema,
  Simulation,
  SimulationSchema,
} from '../../entities/index.entity';
import { CONFIG } from './simulation.config';
import {
  OWN_ESTIMATE_UPLIFT,
  PRICE_CUT,
  REFERENCE_PATHS,
  modelForecast,
  ownEstimateForecast,
  type PathContext,
} from './reference-paths';
import { SimulationService } from './simulation.service';

const ctx = (over: Partial<PathContext> = {}): PathContext => ({
  quarter: 6,
  seasonalMultiplier: 1.25,
  lastActualDemand: { r1: 230000, r2: 210000, r3: 150000 },
  marketShare: 1 / 3,
  open: { ds: true },
  ...over,
});

describe('reference paths', () => {
  it('the model forecast is the expected demand from CONFIG, not a fixed figure', () => {
    const m = CONFIG.market;
    expect(modelForecast(ctx())).toEqual({
      r1: Math.round(m.TOTAL_MARKET_SIZE * m.REGIONS[1].marketShare * 1.25),
      r2: Math.round(m.TOTAL_MARKET_SIZE * m.REGIONS[2].marketShare * 1.25),
      r3: Math.round(m.TOTAL_MARKET_SIZE * m.REGIONS[3].marketShare * 1.25),
    });
  });

  it("the own-estimate forecast is last quarter's actual demand plus 10%", () => {
    expect(OWN_ESTIMATE_UPLIFT).toBe(0.1);
    expect(ownEstimateForecast(ctx())).toEqual({
      r1: 253000,
      r2: 231000,
      r3: 165000,
    });
  });

  it('forecasters use the Demand Science decision only once it is open', () => {
    const open = REFERENCE_PATHS.model_forecaster.decide(ctx());
    expect(open).toMatchObject({ forecastMethod: 'MODEL' });
    expect(open.forecastR1).toBeGreaterThan(0);
    const locked = REFERENCE_PATHS.model_forecaster.decide(
      ctx({ open: { ds: false } }),
    );
    expect(locked).not.toHaveProperty('forecastR1');
    expect(locked).not.toHaveProperty('forecastMethod');
    expect(REFERENCE_PATHS.own_estimate_forecaster.decide(ctx())).toMatchObject(
      { forecastMethod: 'GUT' },
    );
  });

  it('the price cutter prices 15% below base and spends half the marketing', () => {
    expect(PRICE_CUT).toBe(0.15);
    const base = REFERENCE_PATHS.model_forecaster.decide(ctx());
    const cut = REFERENCE_PATHS.price_cutter.decide(ctx());
    expect(cut.priceP1).toBe(Math.round((base.priceP1 as number) * 0.85));
    expect(cut.priceP2).toBe(Math.round((base.priceP2 as number) * 0.85));
    expect(cut.marketingBudget).toBe(
      Math.round((base.marketingBudget as number) * 0.5),
    );
    expect(
      (cut.productionP1 as number) + (cut.productionP2 as number),
    ).toBeGreaterThan(
      (base.productionP1 as number) + (base.productionP2 as number),
    );
  });

  it('every path has a one-sentence plan per quarter', () => {
    for (const path of Object.values(REFERENCE_PATHS)) {
      for (const open of [true, false]) {
        const plan = path.plan(ctx({ open: { ds: open } }));
        expect(plan).toMatch(/^Quarter 6: .+\.$/);
        expect(plan.split('. ').length).toBe(1);
      }
    }
  });
});

describeDb('reference firms at a close', () => {
  let conn: Connection;
  let Sim: Model<any>;
  let Firms: Model<any>;
  let Dec: Model<any>;
  let svc: any;

  beforeAll(async () => {
    conn = await connectTestDb();
    Sim = conn.model(Simulation.name, SimulationSchema);
    Firms = conn.model(Firm.name, FirmSchema);
    Dec = conn.model(Decision.name, DecisionSchema);
  });
  afterAll(async () => {
    await closeTestDb(conn);
  });
  beforeEach(async () => {
    await clearTestDb(conn);
    svc = Object.create(SimulationService.prototype);
    svc.simulationModel = Sim;
    svc.firmModel = Firms;
    svc.decisionModel = Dec;
    svc.quarterStateModel = conn.model(QuarterState.name, QuarterStateSchema);
    svc.demandHistoryModel = conn.model(
      DemandHistory.name,
      DemandHistorySchema,
    );
  });

  async function course(quarter: number, ds: boolean) {
    const sim = await Sim.create({
      name: 'Ref',
      status: 'IN_PROGRESS',
      currentQuarter: quarter,
      totalQuarters: 11,
      orientationQuarters: 2,
      timezone: 'UTC',
      moduleSchedule: {
        mode: 'PROGRESSIVE',
        modules: [
          { moduleId: 'ds', order: 1, unlocksAtQuarter: 6, enabled: ds },
        ],
      },
    } as any);
    const ref = await Firms.create({
      simulation: sim._id,
      firmNumber: 1,
      name: 'Ref firm',
      referencePath: 'model_forecaster',
    });
    const human = await Firms.create({
      simulation: sim._id,
      firmNumber: 2,
      name: 'Human',
    });
    return { sim, ref, human };
  }

  it("writes the reference firm's decision as submitted, and never counts it as missed", async () => {
    const { sim, ref, human } = await course(7, true);
    await svc.submitReferenceDecisions(sim._id);
    const d: any = await Dec.findOne({ firm: ref._id, quarter: 7 }).lean();
    expect(d).toMatchObject({ status: 'SUBMITTED', submittedHow: 'reference' });
    expect(await Dec.findOne({ firm: human._id, quarter: 7 })).toBeNull();
  });

  it('uses Demand Science only after it unlocks', async () => {
    const before = await course(5, true);
    await svc.submitReferenceDecisions(before.sim._id);
    expect(
      ((await Dec.findOne({ firm: before.ref._id, quarter: 5 }).lean()) as any)
        .forecastMethod,
    ).toBe('GUT'); // the schema default: no MODEL choice
    await clearTestDb(conn);
    const after = await course(7, true);
    await svc.submitReferenceDecisions(after.sim._id);
    expect(
      ((await Dec.findOne({ firm: after.ref._id, quarter: 7 }).lean()) as any)
        .forecastMethod,
    ).toBe('MODEL');
  });

  it('does nothing in a course with no reference firms', async () => {
    const sim = await Sim.create({
      name: 'Plain',
      status: 'IN_PROGRESS',
      currentQuarter: 7,
      totalQuarters: 11,
      timezone: 'UTC',
    } as any);
    await Firms.create({ simulation: sim._id, firmNumber: 1, name: 'Human' });
    await svc.submitReferenceDecisions(sim._id);
    expect(await Dec.countDocuments({})).toBe(0);
  });
});
