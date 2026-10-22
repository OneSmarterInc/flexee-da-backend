/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- tests build services with only the models they use */
// Quarter close: every path takes one claim, so a quarter is processed once.
//
// The service is built with only the models these methods use. The heavy
// processing step (processQuarterClose) is replaced with a slow stub that
// moves the quarter on, so the tests exercise the claim, not the engine.

import { ConflictException } from '@nestjs/common';
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
  DecisionStatus,
  Firm,
  FirmSchema,
  Simulation,
  SimulationSchema,
  SimulationStatus,
} from '../../entities/index.entity';
import { SimulationService } from './simulation.service';

describeDb('quarter close claim', () => {
  let conn: Connection;
  let Sim: Model<any>;
  let Dec: Model<any>;
  let FirmModel: Model<any>;
  let svc: any;
  let processed: number;

  const QUARTER = 6;

  async function insertSim(extra: Record<string, unknown> = {}) {
    const _id = new Types.ObjectId();
    await Sim.collection.insertOne({
      _id,
      name: 'Close test',
      status: SimulationStatus.IN_PROGRESS,
      currentQuarter: QUARTER,
      quarterEndsAt: new Date(Date.now() - 60_000),
      closingQuarter: null,
      closingStartedAt: null,
      ...extra,
    });
    return _id;
  }

  beforeAll(async () => {
    conn = await connectTestDb();
    Sim = conn.model(Simulation.name, SimulationSchema);
    Dec = conn.model(Decision.name, DecisionSchema);
    FirmModel = conn.model(Firm.name, FirmSchema);
  });

  afterAll(async () => {
    await closeTestDb(conn);
  });

  beforeEach(async () => {
    await clearTestDb(conn);
    processed = 0;
    svc = Object.create(SimulationService.prototype);
    svc.simulationModel = Sim;
    svc.decisionModel = Dec;
    svc.firmModel = FirmModel;
    svc.carryForwardDecision = jest.fn().mockResolvedValue(undefined);
    svc.processQuarterClose = jest.fn(async (simId: string) => {
      processed += 1;
      await new Promise((r) => setTimeout(r, 50));
      // Like the real close: move to the next quarter and open a new
      // window, so a late caller sees a quarter that isn't due yet.
      await Sim.updateOne(
        { _id: new Types.ObjectId(simId) },
        {
          $inc: { currentQuarter: 1 },
          $set: { quarterEndsAt: new Date(Date.now() + 86_400_000) },
        },
      );
      return { ok: true };
    });
  });

  it('lets only one of two simultaneous claims win', async () => {
    const simId = await insertSim();
    const results = await Promise.all([
      svc.claimQuarterClose(simId, QUARTER),
      svc.claimQuarterClose(simId, QUARTER),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('refuses a claim on a quarter the sim has already left', async () => {
    const simId = await insertSim({ currentQuarter: QUARTER + 1 });
    await expect(svc.claimQuarterClose(simId, QUARTER)).resolves.toBe(false);
  });

  it('takes over a claim older than the stale limit', async () => {
    const old = new Date(
      Date.now() - (SimulationService.QUARTER_CLOSE_STALE_MINUTES + 1) * 60_000,
    );
    const simId = await insertSim({
      closingQuarter: QUARTER,
      closingStartedAt: old,
    });
    await expect(svc.claimQuarterClose(simId, QUARTER)).resolves.toBe(true);
  });

  it('does not take over a live claim', async () => {
    const simId = await insertSim({
      closingQuarter: QUARTER,
      closingStartedAt: new Date(),
    });
    await expect(svc.claimQuarterClose(simId, QUARTER)).resolves.toBe(false);
  });

  it("marks only that quarter's decisions as closed", async () => {
    const simId = await insertSim();
    const firm = new Types.ObjectId();
    await Dec.collection.insertMany([
      {
        simulation: simId,
        firm,
        quarter: QUARTER,
        status: DecisionStatus.DRAFT,
      },
      {
        simulation: simId,
        firm,
        quarter: QUARTER - 1,
        status: DecisionStatus.PROCESSED,
      },
    ]);
    await svc.claimQuarterClose(simId, QUARTER);
    const current = await Dec.findOne({ quarter: QUARTER }).lean<any>();
    const previous = await Dec.findOne({ quarter: QUARTER - 1 }).lean<any>();
    expect(current.quarterClosed).toBe(true);
    expect(previous.quarterClosed).not.toBe(true);
  });

  it('processes the quarter once when page loads, the sweep and the faculty button race', async () => {
    const simId = await insertSim();
    const simDoc = await Sim.findById(simId);
    const results = await Promise.allSettled([
      svc.checkQuarterExpiry(simDoc),
      svc.checkQuarterExpiry(simDoc),
      svc.autoAdvanceExpiredQuarter(String(simId)),
      svc.advanceQuarter(String(simId)),
    ]);

    expect(processed).toBe(1);
    const after = await Sim.findById(simId).lean<any>();
    expect(after.currentQuarter).toBe(QUARTER + 1);
    expect(after.closingQuarter).toBeNull();

    // A losing faculty click gets a clear 409, never a second close.
    for (const r of results) {
      if (r.status === 'rejected') {
        expect(r.reason).toBeInstanceOf(ConflictException);
      }
    }
  });

  it('releases the claim when processing fails, so a retry can run', async () => {
    const simId = await insertSim();
    svc.processQuarterClose = jest.fn().mockRejectedValue(new Error('boom'));
    await expect(svc.advanceQuarter(String(simId))).rejects.toThrow('boom');
    const after = await Sim.findById(simId).lean<any>();
    expect(after.closingQuarter).toBeNull();
    await expect(svc.claimQuarterClose(simId, QUARTER)).resolves.toBe(true);
  });

  it('lifts the close mark on decisions when a faculty close fails', async () => {
    const simId = await insertSim({
      quarterEndsAt: new Date(Date.now() + 86_400_000),
    });
    await Dec.collection.insertOne({
      simulation: simId,
      firm: new Types.ObjectId(),
      quarter: QUARTER,
      status: DecisionStatus.DRAFT,
    });
    svc.processQuarterClose = jest.fn().mockRejectedValue(new Error('boom'));
    await expect(svc.advanceQuarter(String(simId))).rejects.toThrow('boom');
    const d = await Dec.findOne({ quarter: QUARTER }).lean<any>();
    expect(d.quarterClosed).toBe(false);
  });
});
