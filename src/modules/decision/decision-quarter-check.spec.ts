/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- tests build services with only the models they use */
// A decision can only change while its quarter is open, and the check holds
// inside the write: a save that reaches the database after the close has
// started is refused, even if the early check passed.

import { BadRequestException, ConflictException } from '@nestjs/common';
import { Connection, Model, Types } from 'mongoose';
import {
  clearTestDb,
  connectTestDb,
  describeDb,
} from '../../../test/mongo-test-db';
import {
  Decision,
  DecisionSchema,
  DecisionStatus,
  Simulation,
  SimulationSchema,
  SimulationStatus,
} from '../../entities/index.entity';
import { DecisionService } from './decision.service';

describeDb('decision quarter check', () => {
  let conn: Connection;
  let Sim: Model<any>;
  let Dec: Model<any>;
  let svc: any;

  const QUARTER = 6;
  const firm = new Types.ObjectId();

  async function setup(
    simExtra: Record<string, unknown> = {},
    decExtra: Record<string, unknown> = {},
  ) {
    const simId = new Types.ObjectId();
    await Sim.collection.insertOne({
      _id: simId,
      name: 'Quarter check',
      status: SimulationStatus.IN_PROGRESS,
      currentQuarter: QUARTER,
      quarterEndsAt: new Date(Date.now() + 86_400_000),
      closingQuarter: null,
      ...simExtra,
    });
    const decId = new Types.ObjectId();
    await Dec.collection.insertOne({
      _id: decId,
      simulation: simId,
      firm,
      quarter: QUARTER,
      status: DecisionStatus.DRAFT,
      priceP1: 100,
      ...decExtra,
    });
    return { simId, decId };
  }

  beforeAll(async () => {
    conn = await connectTestDb();
    Sim = conn.model(Simulation.name, SimulationSchema);
    Dec = conn.model(Decision.name, DecisionSchema);
  });

  afterAll(async () => {
    await conn.close();
  });

  beforeEach(async () => {
    await clearTestDb(conn);
    svc = Object.create(DecisionService.prototype);
    svc.simulationModel = Sim;
    svc.decisionModel = Dec;
    svc.logger = { debug: jest.fn(), log: jest.fn(), warn: jest.fn() };
  });

  it('saves a change while the quarter is open', async () => {
    const { decId } = await setup();
    await svc.update(String(decId), { priceP1: 120 });
    const d = await Dec.findById(decId).lean<any>();
    expect(d.priceP1).toBe(120);
  });

  it('refuses a change to an earlier quarter', async () => {
    const { decId } = await setup({ currentQuarter: QUARTER + 1 });
    await expect(svc.update(String(decId), { priceP1: 120 })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('refuses a change after the deadline', async () => {
    const { decId } = await setup({
      quarterEndsAt: new Date(Date.now() - 60_000),
    });
    await expect(svc.update(String(decId), { priceP1: 120 })).rejects.toThrow(
      ConflictException,
    );
  });

  it('refuses a change while the close is running', async () => {
    const { decId } = await setup({ closingQuarter: QUARTER });
    await expect(svc.update(String(decId), { priceP1: 120 })).rejects.toThrow(
      ConflictException,
    );
  });

  it('refuses the write itself once the close has marked the decision', async () => {
    // The sim still looks open (the early check passes), but the close has
    // already marked this decision. Only the in-write filter can catch this.
    const { decId } = await setup({}, { quarterClosed: true });
    await expect(svc.update(String(decId), { priceP1: 120 })).rejects.toThrow(
      ConflictException,
    );
    const d = await Dec.findById(decId).lean<any>();
    expect(d.priceP1).toBe(100);
  });

  it('refuses withdrawing a submitted decision after the deadline', async () => {
    const { decId } = await setup(
      { quarterEndsAt: new Date(Date.now() - 60_000) },
      { status: DecisionStatus.SUBMITTED },
    );
    await expect(
      svc.update(String(decId), { status: DecisionStatus.DRAFT }),
    ).rejects.toThrow(ConflictException);
  });

  it('still lets faculty reopen a processed decision', async () => {
    const { decId } = await setup(
      { currentQuarter: QUARTER + 1 },
      { status: DecisionStatus.PROCESSED, quarterClosed: true },
    );
    await svc.update(String(decId), { status: DecisionStatus.DRAFT });
    const d = await Dec.findById(decId).lean<any>();
    expect(d.status).toBe(DecisionStatus.DRAFT);
  });

  it('refuses creating a decision for a quarter that is not open', async () => {
    const simId = new Types.ObjectId();
    await Sim.collection.insertOne({
      _id: simId,
      status: SimulationStatus.IN_PROGRESS,
      currentQuarter: QUARTER,
    });
    await expect(
      svc.create({
        simulation: String(simId),
        firm: String(new Types.ObjectId()),
        quarter: QUARTER + 1,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
