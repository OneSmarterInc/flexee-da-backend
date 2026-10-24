/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument -- the service is built with only the models it uses */
// "This week" (V3 Design G): the firm statuses, the close time in course
// time, and who may ask.

import { ForbiddenException } from '@nestjs/common';
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
  User,
  UserRole,
  UserSchema,
} from '../../entities/index.entity';
import { SimulationService } from './simulation.service';

describeDb('this week', () => {
  let conn: Connection;
  let Sim: Model<any>;
  let Firms: Model<any>;
  let Dec: Model<any>;
  let Users: Model<any>;
  let svc: any;
  const owner = new Types.ObjectId();
  const faculty = { _id: owner, role: UserRole.FACULTY };
  const NOW = new Date('2026-10-28T12:00:00Z');

  beforeAll(async () => {
    conn = await connectTestDb();
    Sim = conn.model(Simulation.name, SimulationSchema);
    Firms = conn.model(Firm.name, FirmSchema);
    Dec = conn.model(Decision.name, DecisionSchema);
    Users = conn.model(User.name, UserSchema);
  });
  afterAll(async () => {
    await closeTestDb(conn);
  });
  beforeEach(async () => {
    await clearTestDb(conn);
    svc = Object.create(SimulationService.prototype);
    Object.assign(svc, {
      simulationModel: Sim,
      firmModel: Firms,
      decisionModel: Dec,
      userModel: Users,
    });
  });

  async function course(extra: Record<string, unknown> = {}) {
    const simId = new Types.ObjectId();
    await Sim.collection.insertOne({
      _id: simId,
      name: 'Spring 2027',
      status: 'IN_PROGRESS',
      currentQuarter: 7,
      totalQuarters: 11,
      timezone: 'America/New_York',
      // 11:59 PM EDT on Thu 29 Oct.
      quarterEndsAt: new Date('2026-10-30T03:59:00Z'),
      owner,
      facultyIds: [],
      ...extra,
    });
    const ids: Types.ObjectId[] = [];
    for (const n of [1, 2, 3, 4]) {
      const _id = new Types.ObjectId();
      ids.push(_id);
      await Firms.collection.insertOne({
        _id,
        simulation: simId,
        firmNumber: n,
        name: `Firm ${n}`,
      });
    }
    return { simId, ids };
  }

  it('reads each firm as submitted, a draft, nothing, or not submitted last quarter', async () => {
    const { simId, ids } = await course();
    const student = new Types.ObjectId();
    await Users.collection.insertOne({
      _id: student,
      firstName: 'Ada',
      lastName: 'Lovelace',
      role: 'STUDENT',
      email: 'a@x.test',
    });
    await Dec.collection.insertMany([
      {
        simulation: simId,
        firm: ids[0],
        quarter: 7,
        status: 'SUBMITTED',
        submittedAt: new Date('2026-10-27T20:30:00Z'),
        submittedBy: student,
      },
      { simulation: simId, firm: ids[1], quarter: 7, status: 'DRAFT' },
      {
        simulation: simId,
        firm: ids[2],
        quarter: 6,
        status: 'PROCESSED',
        submittedHow: 'carried_forward',
      },
    ]);
    const r = await svc.getThisWeek(faculty, String(simId), NOW);
    const byName = Object.fromEntries(r.firms.map((f: any) => [f.firm, f]));
    expect(byName['Firm 1']).toMatchObject({
      status: 'submitted',
      submittedBy: 'Ada Lovelace',
      submittedAt: '27 Oct 2026, 4:30 PM EDT',
    });
    expect(byName['Firm 2'].status).toBe('draft');
    expect(byName['Firm 3']).toMatchObject({
      status: 'nothing',
      lastQuarterNotSubmitted: 6,
    });
    expect(byName['Firm 4']).toMatchObject({
      status: 'nothing',
      lastQuarterNotSubmitted: null,
    });
  });

  it('writes the close time in course time with the zone, and the time left', async () => {
    const { simId } = await course();
    const r = await svc.getThisWeek(faculty, String(simId), NOW);
    expect(r).toMatchObject({
      quarter: 7,
      totalQuarters: 11,
      timeZone: 'America/New_York',
      closesAt: '29 Oct 2026, 11:59 PM EDT',
      timeLeft: '1 day 15 hours',
    });
  });

  it('says when the reminder went and to how many firms, once it has', async () => {
    const { simId } = await course({
      reminderSentForQuarter: 7,
      reminderSentAt: new Date('2026-10-28T03:59:00Z'),
      reminderFirmCount: 2,
    });
    const r = await svc.getThisWeek(faculty, String(simId), NOW);
    expect(r.reminder).toEqual({
      sentAt: '27 Oct 2026, 11:59 PM EDT',
      firms: 2,
    });
    const none = await course();
    expect(
      (await svc.getThisWeek(faculty, String(none.simId), NOW)).reminder,
    ).toBeNull();
  });

  it('a faculty member not on the course gets 403, and a student gets 403; admin is let in', async () => {
    const { simId } = await course();
    await expect(
      svc.getThisWeek(
        { _id: new Types.ObjectId(), role: UserRole.FACULTY },
        String(simId),
        NOW,
      ),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      svc.getThisWeek(
        { _id: owner, role: UserRole.STUDENT },
        String(simId),
        NOW,
      ),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      svc.getThisWeek(
        { _id: new Types.ObjectId(), role: UserRole.ADMIN },
        String(simId),
        NOW,
      ),
    ).resolves.toMatchObject({ quarter: 7 });
  });
});
