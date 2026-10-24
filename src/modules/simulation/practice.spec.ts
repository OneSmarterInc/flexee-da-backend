/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- tests build services with only the models they use */
// Practice courses (V3 Design E): no deadlines, left out of the connector,
// test accounts only in practice, and who may decide.

import { BadRequestException, ForbiddenException } from '@nestjs/common';
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
  Enrollment,
  EnrollmentSchema,
  Firm,
  FirmSchema,
  Simulation,
  SimulationSchema,
  User,
  UserRole,
  UserSchema,
} from '../../entities/index.entity';
import { DecisionService } from '../decision/decision.service';
import { assertCanEnrol, TEST_ACCOUNT_RULE } from './enroll-rules';
import { QuarterTickService } from './quarter-tick.service';
import { SimulationService } from './simulation.service';

jest.mock('../../utils/email.util', () => ({
  sendQuarterReminderEmail: jest.fn().mockResolvedValue(true),
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { sendQuarterReminderEmail } = require('../../utils/email.util');

describe('test accounts and enrolment', () => {
  it('a test account cannot enrol in a live course', () => {
    expect(() =>
      assertCanEnrol({ isTestAccount: true }, { isPractice: false }),
    ).toThrow(BadRequestException);
    expect(() => assertCanEnrol({ isTestAccount: true }, {})).toThrow(
      TEST_ACCOUNT_RULE,
    );
  });
  it('a test account can enrol in a practice course, and others can enrol anywhere', () => {
    expect(() =>
      assertCanEnrol({ isTestAccount: true }, { isPractice: true }),
    ).not.toThrow();
    expect(() =>
      assertCanEnrol({ isTestAccount: false }, { isPractice: false }),
    ).not.toThrow();
    expect(() => assertCanEnrol(null, null)).not.toThrow();
  });
});

describeDb('practice courses', () => {
  let conn: Connection;
  let Sim: Model<any>;
  let Firms: Model<any>;
  let Dec: Model<any>;
  let Enr: Model<any>;
  let Users: Model<any>;

  beforeAll(async () => {
    conn = await connectTestDb();
    Sim = conn.model(Simulation.name, SimulationSchema);
    Firms = conn.model(Firm.name, FirmSchema);
    Dec = conn.model(Decision.name, DecisionSchema);
    Enr = conn.model(Enrollment.name, EnrollmentSchema);
    Users = conn.model(User.name, UserSchema);
  });
  afterAll(async () => {
    await closeTestDb(conn);
  });
  beforeEach(async () => {
    await clearTestDb(conn);
    sendQuarterReminderEmail.mockClear();
  });

  it('the sweep and the reminder skip practice courses', async () => {
    const past = new Date(Date.now() - 3_600_000);
    const soon = new Date(Date.now() + 3_600_000);
    const mk = (extra: Record<string, unknown>) =>
      Sim.collection.insertOne({
        name: 'c',
        status: 'IN_PROGRESS',
        currentQuarter: 5,
        timezone: 'UTC',
        reminderSentForQuarter: null,
        ...extra,
      });
    await mk({ isPractice: true, quarterEndsAt: past });
    await mk({ isPractice: true, quarterEndsAt: soon });
    const advance = jest.fn();
    const svc: any = Object.create(QuarterTickService.prototype);
    Object.assign(svc, {
      simulationModel: Sim,
      firmModel: Firms,
      decisionModel: Dec,
      enrollmentModel: Enr,
      userModel: Users,
      simulationService: { autoAdvanceExpiredQuarter: advance },
      logger: { log: jest.fn(), error: jest.fn() },
      BATCH_LIMIT: 50,
      STALE_CLAIM_MINUTES: 15,
    });
    expect(await svc.sendDueReminders()).toBe(0);
    expect(sendQuarterReminderEmail).not.toHaveBeenCalled();
    await svc.closeExpiredQuarters();
    expect(advance).not.toHaveBeenCalled();
    // A live course in the same state would be picked up.
    const live = await mk({ isPractice: false, quarterEndsAt: past });
    await svc.closeExpiredQuarters();
    expect(advance).toHaveBeenCalledTimes(1);
    expect(advance).toHaveBeenCalledWith(String(live.insertedId));
  });

  describe('who may decide', () => {
    let svc: any;
    beforeEach(() => {
      svc = Object.create(DecisionService.prototype);
      svc.firmModel = Firms;
      svc.simulationModel = Sim;
      svc.enrollmentModel = Enr;
    });

    async function course(isPractice: boolean) {
      const owner = new Types.ObjectId();
      const sim = await Sim.collection.insertOne({
        name: 'c',
        isPractice,
        owner,
        facultyIds: [],
        status: 'IN_PROGRESS',
      });
      const mine = await Firms.collection.insertOne({
        simulation: sim.insertedId,
        firmNumber: 1,
        name: 'Mine',
      });
      const ref = await Firms.collection.insertOne({
        simulation: sim.insertedId,
        firmNumber: 2,
        name: 'Ref',
        referencePath: 'price_cutter',
      });
      await Enr.collection.insertOne({
        simulation: sim.insertedId,
        firm: mine.insertedId,
        user: owner,
        status: 'ACTIVE',
      });
      return {
        sim: sim.insertedId,
        mine: mine.insertedId,
        ref: ref.insertedId,
        faculty: { _id: owner, role: UserRole.FACULTY },
      };
    }

    it('faculty can decide for their own firm in a practice course', async () => {
      const c = await course(true);
      await expect(
        svc.assertCanDecide(c.faculty, c.sim, c.mine),
      ).resolves.toBeUndefined();
    });

    it("faculty cannot decide for a live course's firm", async () => {
      const c = await course(false);
      await expect(
        svc.assertCanDecide(c.faculty, c.sim, c.mine),
      ).rejects.toThrow(ForbiddenException);
    });

    it('nobody decides for a reference firm, and a practice course is not open to other faculty', async () => {
      const c = await course(true);
      await expect(
        svc.assertCanDecide(c.faculty, c.sim, c.ref),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        svc.assertCanDecide(
          { _id: new Types.ObjectId(), role: UserRole.FACULTY },
          c.sim,
          c.mine,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('a student is not blocked by the new check, and internal calls are not checked', async () => {
      const c = await course(false);
      await expect(
        svc.assertCanDecide(
          { _id: new Types.ObjectId(), role: UserRole.STUDENT },
          c.sim,
          c.mine,
        ),
      ).resolves.toBeUndefined();
      await expect(
        svc.assertCanDecide(undefined, c.sim, c.mine),
      ).resolves.toBeUndefined();
    });
  });

  describe('the connector and student counts', () => {
    it('counts leave out test accounts', async () => {
      const sim = await Sim.collection.insertOne({
        name: 'c',
        status: 'IN_PROGRESS',
      });
      const real = await Users.collection.insertOne({
        email: 'a@x.test',
        role: 'STUDENT',
        isActive: true,
      });
      const test = await Users.collection.insertOne({
        email: 'b@x.test',
        role: 'STUDENT',
        isActive: true,
        isTestAccount: true,
      });
      await Enr.collection.insertMany([
        { simulation: sim.insertedId, user: real.insertedId, status: 'ACTIVE' },
        { simulation: sim.insertedId, user: test.insertedId, status: 'ACTIVE' },
      ]);
      const svc: any = Object.create(SimulationService.prototype);
      svc.userModel = Users;
      svc.enrollmentModel = Enr;
      expect(await svc.countRealStudents(sim.insertedId)).toBe(1);
    });
  });
});
