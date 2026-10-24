/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument -- the service is built with only the models it uses */
// Building and rewording the quarter texts, with a fake Claude.

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
  Event,
  EventImpact,
  EventImpactSchema,
  EventSchema,
  Firm,
  FirmSchema,
  ForecastLog,
  ForecastLogSchema,
  KpiHistory,
  KpiHistorySchema,
  Simulation,
  SimulationSchema,
} from '../../entities/index.entity';
import {
  QuarterCloseLog,
  QuarterCloseLogSchema,
} from '../reporting/reporting.schemas';
import { AiCall, AiCallSchema } from '../ai/ai-use.schema';
import { AiUseService } from '../ai/ai-use.service';
import { Narrative, NarrativeSchema } from './narrative.schema';
import { NarrativesService, REWORD_BATCH } from './narratives.service';

describeDb('narratives', () => {
  let conn: Connection;
  let Sim: Model<any>;
  let Firms: Model<any>;
  let Kpi: Model<any>;
  let Dec: Model<any>;
  let Narr: Model<any>;
  let Calls: Model<any>;
  let svc: NarrativesService;
  let ai: AiUseService;
  let claude: jest.Mock;

  beforeAll(async () => {
    conn = await connectTestDb();
    Sim = conn.model(Simulation.name, SimulationSchema);
    Firms = conn.model(Firm.name, FirmSchema);
    Kpi = conn.model(KpiHistory.name, KpiHistorySchema);
    Dec = conn.model(Decision.name, DecisionSchema);
    Narr = conn.model(Narrative.name, NarrativeSchema);
    Calls = conn.model(AiCall.name, AiCallSchema);
  });
  afterAll(async () => {
    await closeTestDb(conn);
  });

  beforeEach(async () => {
    await clearTestDb(conn);
    await Narr.syncIndexes();
    ai = new AiUseService(Calls as any);
    ai.settings = {
      available: true,
      model: 'claude-haiku-4-5',
      ceilingUsd: 1000,
      inputUsdPerMTok: 1,
      outputUsdPerMTok: 5,
    };
    svc = new NarrativesService(
      ai,
      Narr as any,
      Sim as any,
      Firms as any,
      Dec as any,
      Kpi as any,
      conn.model(ForecastLog.name, ForecastLogSchema) as any,
      conn.model(DemandHistory.name, DemandHistorySchema) as any,
      conn.model(Event.name, EventSchema) as any,
      conn.model(EventImpact.name, EventImpactSchema) as any,
      conn.model(QuarterCloseLog.name, QuarterCloseLogSchema) as any,
    );
    claude = jest.fn();
    svc.callClaude = claude as any;
  });

  async function course(extra: Record<string, unknown> = {}) {
    const _id = new Types.ObjectId();
    await Sim.collection.insertOne({
      _id,
      name: 'Spring 2027',
      status: 'IN_PROGRESS',
      currentQuarter: 8,
      totalQuarters: 11,
      orientationQuarters: 2,
      timezone: 'America/New_York',
      moduleSchedule: {
        mode: 'PROGRESSIVE',
        modules: [{ moduleId: 'sa', unlocksAtQuarter: 8, enabled: true }],
      },
      ...extra,
    });
    const firms: Types.ObjectId[] = [];
    for (const n of [1, 2]) {
      const fid = new Types.ObjectId();
      firms.push(fid);
      await Firms.collection.insertOne({
        _id: fid,
        simulation: _id,
        firmNumber: n,
        name: `Firm ${n}`,
      });
      for (const q of [6, 7]) {
        await Kpi.collection.insertOne({
          simulation: _id,
          firm: fid,
          quarter: q,
          financial: {
            revenue: 70_000_000 + (q === 7 ? 7_000_000 : 0),
            netIncome: 5_000_000,
            cash: 20_000_000,
          },
          customer: {
            fillRate: q === 7 ? 0.85 : 0.95,
            marketShare: 0.35,
            csi: 85,
          },
          bsc: { overall: 70 },
        });
        await Dec.collection.insertOne({
          simulation: _id,
          firm: fid,
          quarter: q,
          status: 'PROCESSED',
          submittedHow: n === 2 && q === 7 ? 'carried_forward' : 'team',
          productionP1: 100,
          productionP2: 100,
          priceP1: 500,
          priceP2: 850,
          marketingBudget: 5_000_000,
        });
      }
    }
    // No close log is written: the close log comes after the texts are built.
    return { _id, firms };
  }

  it('writes one reading and one explanation per firm, and a second build replaces them', async () => {
    const c = await course();
    await svc.buildQuarter(c._id, 7);
    expect(await Narr.countDocuments({ kind: 'reading' })).toBe(1);
    expect(await Narr.countDocuments({ kind: 'explanation' })).toBe(2);
    const reading: any = await Narr.findOne({ kind: 'reading' }).lean();
    expect(reading.engineText).toContain(
      "1 firm's decisions were carried forward",
    );
    expect(reading.engineText).toContain(
      'Supplier Analytics unlocks in Quarter 8.',
    );
    const carried: any = await Narr.findOne({
      kind: 'explanation',
      firmId: c.firms[1],
    }).lean();
    expect(carried.engineText).toContain(
      "Your team didn't submit this quarter",
    );
    // A second build replaces, never duplicates, and clears any rewording.
    await Narr.updateOne(
      { kind: 'reading' },
      { $set: { text: 'old', rewordOutcome: 'kept' } },
    );
    await svc.buildQuarter(c._id, 7);
    expect(await Narr.countDocuments({})).toBe(3);
    expect(await Narr.findOne({ kind: 'reading' }).lean()).toMatchObject({
      text: null,
      rewordOutcome: 'pending',
    });
  });

  it("never gives a firm another firm's name in its explanation", async () => {
    const c = await course();
    await svc.buildQuarter(c._id, 7);
    const rows: any[] = await Narr.find({ kind: 'explanation' }).lean();
    for (const r of rows) expect(r.engineText).not.toMatch(/Firm \d/);
  });

  it('a builder that throws is logged and does not fail', async () => {
    const c = await course();
    jest.spyOn(svc, 'buildQuarter').mockRejectedValueOnce(new Error('boom'));
    await expect(svc.buildSafely(c._id, 7)).resolves.toBeUndefined();
  });

  it('writes the debrief captions at the last quarter', async () => {
    const c = await course({ totalQuarters: 7 });
    await svc.buildDebrief(c._id, 7);
    expect(
      await Narr.countDocuments({ kind: 'debrief_caption' }),
    ).toBeGreaterThan(0);
  });

  describe('rewording', () => {
    const ok = (text: string) => ({
      text,
      usage: { inputTokens: 100, outputTokens: 50 },
    });

    it('with AI off marks the text off and makes no call', async () => {
      const c = await course({ aiEnabled: false });
      await svc.buildQuarter(c._id, 7);
      await svc.rewordPending();
      expect(claude).not.toHaveBeenCalled();
      expect(await Narr.countDocuments({ rewordOutcome: 'off' })).toBe(3);
    });

    it('with the ceiling reached marks the text off', async () => {
      const c = await course();
      ai.settings.ceilingUsd = 0.01;
      await Calls.create({
        feature: 'ask_claude',
        model: 'm',
        outcome: 'kept',
        costUsd: 5,
      });
      await svc.buildQuarter(c._id, 7);
      await svc.rewordPending();
      expect(claude).not.toHaveBeenCalled();
      expect(await Narr.countDocuments({ rewordOutcome: 'off' })).toBe(3);
    });

    it('keeps a passing rewording and shows it, with one ai_calls row per call and the right feature', async () => {
      const c = await course();
      await svc.buildQuarter(c._id, 7);
      claude.mockImplementation(async (_s: string, user: string) =>
        ok(user.split('ENGINE_TEXT: ')[1]),
      );
      await svc.rewordPending();
      const rows: any[] = await Narr.find({}).lean();
      expect(
        rows.every(
          (r) => r.rewordOutcome === 'kept' && r.text === r.engineText,
        ),
      ).toBe(true);
      const calls: any[] = await Calls.find({}).lean();
      expect(calls).toHaveLength(3);
      expect(calls.filter((x) => x.feature === 'readings')).toHaveLength(1);
      expect(
        calls.filter((x) => x.feature === 'team_explanations'),
      ).toHaveLength(2);
      expect(calls[0].model).toBe('claude-haiku-4-5');
      expect((await svc.readings(c._id))[0]).toMatchObject({ reworded: true });
    });

    it('drops a failing rewording as checks_failed and the engine text is shown', async () => {
      const c = await course();
      await svc.buildQuarter(c._id, 7);
      claude.mockResolvedValue(
        ok('Everything is perfect, 99 firms submitted, the best result.'),
      );
      await svc.rewordPending();
      const reading: any = await Narr.findOne({ kind: 'reading' }).lean();
      expect(reading).toMatchObject({
        rewordOutcome: 'checks_failed',
        text: null,
      });
      expect((await svc.readings(c._id))[0]).toMatchObject({
        reworded: false,
        text: reading.engineText,
      });
      const call: any = await Calls.findOne({ feature: 'readings' }).lean();
      expect(call.outcome).toBe('checks_failed');
    });

    it('records an error when Claude cannot be reached and keeps the engine text', async () => {
      const c = await course();
      await svc.buildQuarter(c._id, 7);
      claude.mockRejectedValue(new Error('network down'));
      await svc.rewordPending();
      expect(await Narr.countDocuments({ rewordOutcome: 'error' })).toBe(3);
      expect(await Calls.countDocuments({ outcome: 'error' })).toBe(3);
    });

    it('two overlapping sweeps reword each text once', async () => {
      const c = await course();
      await svc.buildQuarter(c._id, 7);
      claude.mockImplementation(async (_s: string, user: string) => {
        await new Promise((r) => setTimeout(r, 20));
        return ok(user.split('ENGINE_TEXT: ')[1]);
      });
      await Promise.all([svc.rewordPending(), svc.rewordPending()]);
      expect(claude).toHaveBeenCalledTimes(3);
      expect(await Calls.countDocuments({})).toBe(3);
    });

    it('a rebuild during rewording keeps the new engine text and is not overwritten', async () => {
      const c = await course();
      await svc.buildQuarter(c._id, 7);
      claude.mockImplementation(async (_s: string, user: string) => {
        // The close is rebuilt while Claude is still working.
        await svc.buildQuarter(c._id, 7);
        await Narr.updateMany(
          {},
          { $set: { engineText: 'The new engine text.' } },
        );
        return ok(user.split('ENGINE_TEXT: ')[1]);
      });
      await svc.rewordPending();
      const rows: any[] = await Narr.find({}).lean();
      expect(rows.every((r) => r.text === null || r.text === undefined)).toBe(
        true,
      );
      expect(rows.every((r) => r.rewordOutcome !== 'kept')).toBe(true);
    });

    it('takes back a claim that went stale', async () => {
      const c = await course();
      await Narr.create({
        simulationId: c._id,
        firmId: null,
        quarter: 3,
        kind: 'reading',
        engineText: 'Quarter 3 closed.',
        rewordOutcome: 'working',
        rewordClaimedAt: new Date(Date.now() - 3_600_000),
      });
      claude.mockImplementation(async (_s: string, user: string) =>
        ok(user.split('ENGINE_TEXT: ')[1]),
      );
      await svc.rewordPending();
      expect(await Narr.countDocuments({ rewordOutcome: 'kept' })).toBe(1);
    });

    it('rewords at most 10 per run, oldest first', async () => {
      const c = await course();
      for (let q = 1; q <= 12; q++) {
        await Narr.create({
          simulationId: c._id,
          firmId: null,
          quarter: q,
          kind: 'reading',
          engineText: `Quarter ${q} closed.`,
        });
      }
      claude.mockImplementation(async (_s: string, user: string) =>
        ok(user.split('ENGINE_TEXT: ')[1]),
      );
      expect(await svc.rewordPending()).toBe(REWORD_BATCH);
      expect(await Narr.countDocuments({ rewordOutcome: 'kept' })).toBe(10);
      expect(await Narr.countDocuments({ rewordOutcome: 'pending' })).toBe(2);
    });
  });
});
