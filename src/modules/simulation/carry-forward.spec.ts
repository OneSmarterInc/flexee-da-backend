/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- tests build services with only the models they use */
// carryForwardDecision records how each missed-or-promoted decision was made.

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
} from '../../entities/index.entity';
import { SimulationService } from './simulation.service';

describeDb('carryForwardDecision submittedHow', () => {
  let conn: Connection;
  let Dec: Model<any>;
  let svc: any;
  const sim = new Types.ObjectId();
  const firm = new Types.ObjectId();

  beforeAll(async () => {
    conn = await connectTestDb();
    Dec = conn.model(Decision.name, DecisionSchema);
  });
  afterAll(async () => {
    await closeTestDb(conn);
  });
  beforeEach(async () => {
    await clearTestDb(conn);
    svc = Object.create(SimulationService.prototype);
    svc.decisionModel = Dec;
  });

  const find = (quarter: number) =>
    Dec.findOne({ simulation: sim, firm, quarter }).lean() as Promise<any>;

  it('marks a copy of last quarter as carried_forward', async () => {
    await Dec.create({
      simulation: sim,
      firm,
      quarter: 4,
      status: DecisionStatus.PROCESSED,
      submittedHow: 'team',
    });
    await svc.carryForwardDecision(sim, firm, 5);
    const d = await find(5);
    expect(d.status).toBe(DecisionStatus.SUBMITTED);
    expect(d.submittedHow).toBe('carried_forward');
  });

  it('marks a promoted draft as draft_promoted', async () => {
    await Dec.create({ simulation: sim, firm, quarter: 5 });
    await svc.carryForwardDecision(sim, firm, 5);
    expect((await find(5)).submittedHow).toBe('draft_promoted');
  });

  it('marks a decision with no earlier one as baseline', async () => {
    await svc.carryForwardDecision(sim, firm, 4);
    expect((await find(4)).submittedHow).toBe('baseline');
  });

  it('promotes a draft the team saved, and a legacy draft with no flag', async () => {
    await Dec.create({ simulation: sim, firm, quarter: 5, editedByTeam: true });
    await svc.carryForwardDecision(sim, firm, 5);
    expect((await find(5)).submittedHow).toBe('draft_promoted');
    await clearTestDb(conn);
    await Dec.collection.insertOne({
      simulation: sim,
      firm,
      quarter: 5,
      status: DecisionStatus.DRAFT,
    });
    await svc.carryForwardDecision(sim, firm, 5);
    expect((await find(5)).submittedHow).toBe('draft_promoted');
  });

  it("does not count a draft made only by opening the cockpit as played: last quarter's decisions are carried forward", async () => {
    await Dec.create({
      simulation: sim,
      firm,
      quarter: 4,
      status: DecisionStatus.PROCESSED,
      submittedHow: 'team',
      priceP1: 777,
    });
    await Dec.create({
      simulation: sim,
      firm,
      quarter: 5,
      editedByTeam: false,
    });
    await svc.carryForwardDecision(sim, firm, 5);
    const d = await find(5);
    expect(d.submittedHow).toBe('carried_forward');
    expect(d.priceP1).toBe(777);
    expect(
      await Dec.countDocuments({ simulation: sim, firm, quarter: 5 }),
    ).toBe(1);
  });
});
