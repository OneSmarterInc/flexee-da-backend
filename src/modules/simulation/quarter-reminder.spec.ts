/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- tests build services with only the models they use */
// The day-before reminder: once per quarter, only to students on teams
// that haven't submitted, with the time in the course zone.

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
  Enrollment,
  EnrollmentSchema,
  EnrollmentStatus,
  Firm,
  FirmSchema,
  Simulation,
  SimulationSchema,
  SimulationStatus,
  User,
  UserRole,
  UserSchema,
} from '../../entities/index.entity';
import { QuarterTickService } from './quarter-tick.service';

jest.mock('../../utils/email.util', () => ({
  sendQuarterReminderEmail: jest.fn().mockResolvedValue(true),
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { sendQuarterReminderEmail } = require('../../utils/email.util');

describeDb('quarter reminder', () => {
  let conn: Connection;
  let Sim: Model<any>;
  let FirmModel: Model<any>;
  let Dec: Model<any>;
  let Enr: Model<any>;
  let UserModel: Model<any>;
  let svc: any;

  const QUARTER = 6;

  async function seed(endsInHours: number) {
    const simId = new Types.ObjectId();
    await Sim.collection.insertOne({
      _id: simId,
      name: 'MIS 4400 Fall',
      status: SimulationStatus.IN_PROGRESS,
      currentQuarter: QUARTER,
      timezone: 'America/New_York',
      quarterEndsAt: new Date(Date.now() + endsInHours * 3_600_000),
      reminderSentForQuarter: null,
    });
    const firmA = new Types.ObjectId(); // submitted
    const firmB = new Types.ObjectId(); // not submitted
    await FirmModel.collection.insertMany([
      { _id: firmA, simulation: simId, firmNumber: 1 },
      { _id: firmB, simulation: simId, firmNumber: 2 },
    ]);
    await Dec.collection.insertOne({
      simulation: simId,
      firm: firmA,
      quarter: QUARTER,
      status: DecisionStatus.SUBMITTED,
    });
    const users = [1, 2, 3].map(() => new Types.ObjectId());
    await UserModel.collection.insertMany(
      users.map((_id, i) => ({
        _id,
        email: `s${i}@example.test`,
        firstName: `S${i}`,
        role: UserRole.STUDENT,
        isActive: true,
      })),
    );
    await Enr.collection.insertMany([
      {
        simulation: simId,
        firm: firmA,
        user: users[0],
        status: EnrollmentStatus.ACTIVE,
        canSubmitDecisions: true,
      },
      {
        simulation: simId,
        firm: firmB,
        user: users[1],
        status: EnrollmentStatus.ACTIVE,
        canSubmitDecisions: true,
      },
      {
        simulation: simId,
        firm: firmB,
        user: users[2],
        status: EnrollmentStatus.DROPPED,
        canSubmitDecisions: true,
      },
    ]);
    return simId;
  }

  beforeAll(async () => {
    conn = await connectTestDb();
    Sim = conn.model(Simulation.name, SimulationSchema);
    FirmModel = conn.model(Firm.name, FirmSchema);
    Dec = conn.model(Decision.name, DecisionSchema);
    Enr = conn.model(Enrollment.name, EnrollmentSchema);
    UserModel = conn.model(User.name, UserSchema);
  });

  afterAll(async () => {
    await closeTestDb(conn);
  });

  beforeEach(async () => {
    await clearTestDb(conn);
    sendQuarterReminderEmail.mockClear();
    svc = Object.create(QuarterTickService.prototype);
    Object.assign(svc, {
      simulationModel: Sim,
      firmModel: FirmModel,
      decisionModel: Dec,
      enrollmentModel: Enr,
      userModel: UserModel,
      logger: { log: jest.fn(), error: jest.fn() },
      BATCH_LIMIT: 50,
    });
  });

  it('emails only active students on teams that have not submitted', async () => {
    await seed(10);
    await expect(svc.sendDueReminders()).resolves.toBe(1);
    expect(sendQuarterReminderEmail).toHaveBeenCalledTimes(1);
    const [email, name, simName, quarter, closesAt] =
      sendQuarterReminderEmail.mock.calls[0];
    expect(email).toBe('s1@example.test');
    expect(name).toBe('S1');
    expect(simName).toBe('MIS 4400 Fall');
    expect(quarter).toBe(QUARTER);
    expect(closesAt).toMatch(
      /^\d{1,2} [A-Z][a-z]{2} \d{4}, \d{1,2}:\d{2} [AP]M E[DS]T$/,
    );
  });

  it('sends once per quarter, however many sweeps run', async () => {
    await seed(10);
    await Promise.all([svc.sendDueReminders(), svc.sendDueReminders()]);
    await svc.sendDueReminders();
    expect(sendQuarterReminderEmail).toHaveBeenCalledTimes(1);
  });

  it('waits until the quarter closes within a day', async () => {
    await seed(30);
    await expect(svc.sendDueReminders()).resolves.toBe(0);
    expect(sendQuarterReminderEmail).not.toHaveBeenCalled();
  });

  it('sends nothing once the deadline has passed', async () => {
    await seed(-1);
    await expect(svc.sendDueReminders()).resolves.toBe(0);
  });
});
