/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- tests build services with only the models they use */
// V3 F1: deploying to students starts play, so the first student quarter
// opens then and closes on its own at its deadline.

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
  Simulation,
  SimulationSchema,
  SimulationStatus,
} from '../../entities/index.entity';
import { formatCourseDateTime } from '../../lib/courseTime';
import { SimulationService } from './simulation.service';

describeDb('student deploy starts play', () => {
  let conn: Connection;
  let Sim: Model<any>;
  let Dec: Model<any>;
  let FirmModel: Model<any>;
  let svc: any;

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
    svc = Object.create(SimulationService.prototype);
    svc.simulationModel = Sim;
    svc.firmModel = FirmModel;
    svc.decisionModel = Dec;
  });

  async function seed(extra: Record<string, unknown> = {}) {
    const _id = new Types.ObjectId();
    const created = new Date(Date.now() - 20 * 86_400_000);
    await Sim.collection.insertOne({
      _id,
      name: 'Deploy test',
      status: SimulationStatus.INITIALIZED,
      deploymentStatus: 'FACULTY_DEPLOYED',
      currentQuarter: 4,
      totalQuarters: 11,
      quarterDurationDays: 14,
      timezone: 'America/New_York',
      // The window set at creation, long ago: already past.
      quarterStartedAt: created,
      quarterEndsAt: new Date(created.getTime() + 14 * 86_400_000),
      ...extra,
    });
    await FirmModel.collection.insertOne({ simulation: _id, firmNumber: 1 });
    return _id;
  }

  it('opens the first student quarter at deployment, on the course calendar', async () => {
    const id = await seed();
    const before = Date.now();
    await svc.deploySimulation(String(id), 'student');
    const sim = await Sim.findById(id).lean<any>();
    expect(sim.status).toBe(SimulationStatus.IN_PROGRESS);
    expect(sim.deploymentStatus).toBe('STUDENT_DEPLOYED');
    expect(new Date(sim.quarterStartedAt).getTime()).toBeGreaterThanOrEqual(
      before,
    );
    // 14 calendar days later, at 11:59 PM New York time.
    const days = (new Date(sim.quarterEndsAt).getTime() - before) / 86_400_000;
    expect(days).toBeGreaterThan(13.9);
    expect(days).toBeLessThan(15.1);
    expect(formatCourseDateTime(sim.quarterEndsAt, 'America/New_York')).toMatch(
      /, 11:59 PM E[DS]T$/,
    );
  });

  it('then closes on its own once the deadline passes', async () => {
    const id = await seed();
    await svc.deploySimulation(String(id), 'student');
    // Move the deadline into the past, as time would.
    await Sim.updateOne(
      { _id: id },
      { $set: { quarterEndsAt: new Date(Date.now() - 60_000) } },
    );
    svc.carryForwardDecision = jest.fn().mockResolvedValue(undefined);
    svc.quarterCloseLogModel = { create: jest.fn().mockResolvedValue({}) };
    svc.processQuarterClose = jest.fn().mockResolvedValue({ ok: true });
    await expect(svc.autoAdvanceExpiredQuarter(String(id))).resolves.toBe(true);
    expect(svc.processQuarterClose).toHaveBeenCalledTimes(1);
  });

  it('leaves a faculty-only deployment as it was', async () => {
    const id = await seed({ deploymentStatus: 'NOT_DEPLOYED' });
    await svc.deploySimulation(String(id), 'faculty');
    const sim = await Sim.findById(id).lean<any>();
    expect(sim.status).toBe(SimulationStatus.INITIALIZED);
  });
});
