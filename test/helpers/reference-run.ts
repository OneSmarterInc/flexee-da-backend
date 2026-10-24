/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument -- the whole app is driven through its services */
// Runs a standard-preset course, with a fixed seed and only the three
// reference firms, from Quarter 4 to the last quarter, through the real
// advanceQuarter(). Shared by the golden and calibration tests.

import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Model, Types } from 'mongoose';
import { AppModule } from '../../src/app.module';
import {
  Firm,
  KpiHistory,
  Simulation,
  User,
  UserRole,
} from '../../src/entities/index.entity';
import { REFERENCE_PATH_IDS } from '../../src/modules/simulation/reference-paths';
import { SimulationService } from '../../src/modules/simulation/simulation.service';
import { loadOutcomes } from '../../src/modules/reports/outcome.loader';

export interface PathResult {
  /** Average of each scorecard score over the student quarters, to one decimal. */
  scores: {
    financial: number;
    customer: number;
    process: number;
    learning: number;
  };
  outcome: string | null;
  /** Final market share, to three decimals. */
  marketShare: number;
  /** Final gross margin, in percent, to one decimal. */
  grossMargin: number;
}
export type RunResult = Record<(typeof REFERENCE_PATH_IDS)[number], PathResult>;

export async function startApp(): Promise<INestApplication> {
  process.env.MONGODB_URI = process.env.MONGO_TEST_URI;
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'e2e-only';
  process.env.CRON_QUARTER_TICK_ENABLED = 'false';
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

const round = (n: number, places: number) =>
  Math.round(n * 10 ** places) / 10 ** places;

export async function runReferenceCourse(
  app: INestApplication,
  seed: number,
): Promise<RunResult> {
  const service = app.get(SimulationService);
  const sims: Model<any> = app.get(getModelToken(Simulation.name));
  const firms: Model<any> = app.get(getModelToken(Firm.name));
  const kpis: Model<any> = app.get(getModelToken(KpiHistory.name));
  const users: Model<any> = app.get(getModelToken(User.name));
  const owner = new Types.ObjectId();
  await users.collection.insertOne({
    _id: owner,
    email: `${owner.toHexString()}@example.test`,
    role: UserRole.ADMIN,
    isActive: true,
    firstName: 'Golden',
    lastName: 'Run',
  });

  const created: any = await service.create(String(owner), {
    name: `Golden run, seed ${seed}`,
    timezone: 'UTC',
    totalQuarters: 11,
    schedulePreset: 'STANDARD_COURSE',
    numFirms: 3,
    randomSeed: seed,
  } as any);
  const id = String(created._id);

  const courseFirms = await firms
    .find({ simulation: created._id })
    .sort({ firmNumber: 1 });
  const byPath = new Map<string, Types.ObjectId>();
  for (const [i, firm] of courseFirms.entries()) {
    await firms.updateOne(
      { _id: firm._id },
      {
        $set: {
          referencePath: REFERENCE_PATH_IDS[i],
          name: REFERENCE_PATH_IDS[i],
        },
      },
    );
    byPath.set(REFERENCE_PATH_IDS[i], firm._id);
  }

  await service.deploySimulation(id, 'faculty');
  await service.deploySimulation(id, 'student');
  for (;;) {
    const sim: any = await sims.findById(created._id).lean();
    if (sim.currentQuarter > sim.totalQuarters) break;
    await service.advanceQuarter(id);
  }

  const outcomes = await loadOutcomes(
    {
      kpiHistoryModel: kpis,
      decisionModel: app.get(getModelToken('Decision')),
      simulationModel: sims,
    },
    created._id,
  );
  const result: Partial<RunResult> = {};
  for (const [pathId, firmId] of byPath) {
    const rows: any[] = await kpis
      .find({ simulation: created._id, firm: firmId, quarter: { $gte: 4 } })
      .sort({ quarter: 1 })
      .lean();
    const avg = (pick: (k: any) => number) =>
      round(rows.reduce((a, k) => a + pick(k), 0) / rows.length, 1);
    const last = rows[rows.length - 1];
    result[pathId as keyof RunResult] = {
      scores: {
        financial: avg((k) => k.bsc.financial),
        customer: avg((k) => k.bsc.customer),
        process: avg((k) => k.bsc.process),
        learning: avg((k) => k.bsc.learning),
      },
      outcome: outcomes.get(String(firmId))?.label ?? null,
      marketShare: round(last.customer.marketShare, 3),
      grossMargin: round(last.financial.grossMarginPct, 1),
    };
  }
  return result as RunResult;
}
