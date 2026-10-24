/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument -- the whole app is driven through its services */
// Practice courses end to end: "Practise this course", a close, "Start over",
// and what the reporting connector sees (V3 Design E).

import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Decision,
  Firm,
  Simulation,
  User,
  UserRole,
} from '../src/entities/index.entity';
import { ReportingViewsService } from '../src/modules/reporting/reporting-views.service';
import { SimulationService } from '../src/modules/simulation/simulation.service';
import { describeDb } from './mongo-test-db';
import { startApp } from './helpers/reference-run';

describeDb('practice courses (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await startApp();
  }, 60_000);
  afterAll(async () => {
    await app.close();
  });

  it('creates a practice copy, plays a quarter, starts over, and stays out of the connector', async () => {
    const service = app.get(SimulationService);
    const sims: Model<any> = app.get(getModelToken(Simulation.name));
    const firms: Model<any> = app.get(getModelToken(Firm.name));
    const decisions: Model<any> = app.get(getModelToken(Decision.name));
    const users: Model<any> = app.get(getModelToken(User.name));

    const facultyId = new Types.ObjectId();
    await users.collection.insertOne({
      _id: facultyId,
      email: `${facultyId}@x.test`,
      role: UserRole.FACULTY,
      isActive: true,
      firstName: 'F',
      lastName: 'F',
    });
    const faculty = { _id: facultyId, role: UserRole.FACULTY };

    const live: any = await service.create(String(facultyId), {
      name: 'Practice e2e live',
      timezone: 'UTC',
      totalQuarters: 11,
      schedulePreset: 'STANDARD_COURSE',
      numFirms: 3,
    } as any);

    const practice: any = await service.createPractice(
      faculty,
      String(live._id),
    );
    const pid = new Types.ObjectId(String(practice._id ?? practice.id));
    const doc: any = await sims.findById(pid).lean();
    expect(doc).toMatchObject({
      isPractice: true,
      status: 'IN_PROGRESS',
      currentQuarter: 4,
      quarterEndsAt: null,
    });
    expect(String(doc.practiceOf)).toBe(String(live._id));
    const pf: any[] = await firms
      .find({ simulation: pid })
      .sort({ firmNumber: 1 })
      .lean();
    expect(pf.map((f) => f.name)).toEqual([
      'Your practice firm',
      'Model forecaster',
      'Own-estimate forecaster',
      'Price cutter',
    ]);
    expect(pf.filter((f) => f.referencePath).length).toBe(3);

    // A quarter closes only on Advance, and the reference firms play it.
    await service.advanceQuarter(String(pid));
    expect(((await sims.findById(pid).lean()) as any).currentQuarter).toBe(5);
    expect(((await sims.findById(pid).lean()) as any).quarterEndsAt).toBeNull();
    const played = await decisions.countDocuments({
      simulation: pid,
      quarter: 4,
      submittedHow: 'reference',
    });
    expect(played).toBe(3);

    // Start over: back to Quarter 4, with no decisions.
    await service.resetPractice(faculty, String(pid));
    expect(((await sims.findById(pid).lean()) as any).currentQuarter).toBe(4);
    expect(await decisions.countDocuments({ simulation: pid, quarter: { $gte: 4 } })).toBe(0);

    // The connector leaves practice courses out.
    const courses = await app.get(ReportingViewsService).run('report_courses');
    const names = courses.map((c: any) => c.course);
    expect(names).toContain('Practice e2e live');
    expect(names).not.toContain('Practice e2e live (practice)');
  }, 180_000);
});
