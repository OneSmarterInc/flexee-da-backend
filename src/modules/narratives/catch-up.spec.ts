/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument -- the service is built with only the models it uses */
// "While you were away" (V3 Design E).

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
  Firm,
  FirmSchema,
  KpiHistory,
  KpiHistorySchema,
  Simulation,
  SimulationSchema,
} from '../../entities/index.entity';
import { Narrative, NarrativeSchema } from './narrative.schema';
import { NarrativesController } from './narratives.controller';
import { NarrativesService } from './narratives.service';

describeDb('catch-up', () => {
  let conn: Connection;
  let Sim: Model<any>;
  let Kpi: Model<any>;
  let Dec: Model<any>;
  let Narr: Model<any>;
  let svc: NarrativesService;

  beforeAll(async () => {
    conn = await connectTestDb();
    Sim = conn.model(Simulation.name, SimulationSchema);
    Kpi = conn.model(KpiHistory.name, KpiHistorySchema);
    Dec = conn.model(Decision.name, DecisionSchema);
    Narr = conn.model(Narrative.name, NarrativeSchema);
    conn.model(Firm.name, FirmSchema);
  });
  afterAll(async () => {
    await closeTestDb(conn);
  });
  beforeEach(async () => {
    await clearTestDb(conn);
    svc = Object.create(NarrativesService.prototype);
    Object.assign(svc, {
      simulationModel: Sim,
      kpiModel: Kpi,
      decisionModel: Dec,
      narratives: Narr,
    });
  });

  async function course(currentQuarter: number) {
    const simId = new Types.ObjectId();
    const firmId = new Types.ObjectId();
    await Sim.collection.insertOne({
      _id: simId,
      name: 'c',
      status: 'IN_PROGRESS',
      currentQuarter,
      moduleSchedule: {
        modules: [{ moduleId: 'ds', unlocksAtQuarter: 6, enabled: true }],
      },
    });
    for (let q = 3; q < currentQuarter; q++) {
      await Kpi.collection.insertOne({
        simulation: simId,
        firm: firmId,
        quarter: q,
        financial: { revenue: 1_000_000 * q, netIncome: 100_000 * q },
        customer: { fillRate: 0.9, marketShare: 0.33 },
      });
      await Dec.collection.insertOne({
        simulation: simId,
        firm: firmId,
        quarter: q,
        status: 'PROCESSED',
        submittedHow: q === 6 ? 'carried_forward' : 'team',
      });
    }
    return { simId, firmId };
  }

  it('a student who last saw quarter 5, with the course at quarter 8, sees quarters 7 and 6, newest first', async () => {
    const { simId, firmId } = await course(8);
    const r = await svc.catchUp(simId, String(firmId), 5);
    expect(r.quarters.map((q: any) => q.quarter)).toEqual([7, 6]);
    expect(r.quarters[1]).toMatchObject({
      submitted: false,
      submissionLine: "Not submitted: last quarter's decisions were used.",
      unlocked: ['Demand Science'],
    });
    expect(r.quarters[0]).toMatchObject({ submitted: true, unlocked: [] });
  });

  it('a late joiner sees from quarter 4, at most four quarters', async () => {
    const { simId, firmId } = await course(11);
    const r = await svc.catchUp(simId, String(firmId), null);
    expect(r.quarters.map((q: any) => q.quarter)).toEqual([10, 9, 8, 7]);
    const early = await course(6);
    const r2 = await svc.catchUp(early.simId, String(early.firmId), null);
    expect(r2.quarters.map((q: any) => q.quarter)).toEqual([5, 4]);
  });

  it("uses the firm's explanation, and its figures against the quarter before when there is none", async () => {
    const { simId, firmId } = await course(8);
    await Narr.create({
      simulationId: simId,
      firmId,
      quarter: 7,
      kind: 'explanation',
      engineText: 'Engine words.',
      text: 'Reworded words.',
    });
    const r = await svc.catchUp(simId, String(firmId), 5);
    expect(r.quarters[0].explanation).toBe('Reworded words.');
    expect(r.quarters[1].explanation).toBe(
      'Revenue went from $5,000,000 to $6,000,000; net income went from $500,000 to $600,000; fill rate went from 90.0% to 90.0%; market share went from 33.0% to 33.0%.',
    );
  });

  it('shows nothing when the student has seen every closed quarter', async () => {
    const { simId, firmId } = await course(8);
    expect((await svc.catchUp(simId, String(firmId), 7)).quarters).toEqual([]);
  });

  it('"Got it" moves lastSeenQuarter to the latest closed quarter', async () => {
    const { simId, firmId } = await course(8);
    const enrollment: any = {
      firm: firmId,
      lastSeenQuarter: 5,
      save: jest.fn(),
    };
    const controller = new NarrativesController(
      {} as never,
      { findById: async () => ({ _id: simId, currentQuarter: 8 }) } as never,
      { findOne: async () => enrollment } as never,
    );
    expect(
      await controller.seen(String(simId), {
        user: { _id: new Types.ObjectId() },
      }),
    ).toEqual({ lastSeenQuarter: 7 });
    expect(enrollment.save).toHaveBeenCalled();
  });
});
