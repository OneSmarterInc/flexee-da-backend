/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument -- the service is built with only the models it uses */
// The lookups read only this course, never return a student's name or email,
// and write dates in course time with the zone.

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
  ForecastLog,
  ForecastLogSchema,
  KpiHistory,
  KpiHistorySchema,
  Simulation,
  SimulationSchema,
  User,
  UserSchema,
} from '../../entities/index.entity';
import {
  QuarterCloseLog,
  QuarterCloseLogSchema,
} from '../reporting/reporting.schemas';
import { AiCall, AiCallSchema } from './ai-use.schema';
import { AiUseService } from './ai-use.service';
import { AskClaudeService } from './ask-claude.service';
import { AskClaudeTools } from './ask-claude-tools';
import { AskQuestion, AskQuestionSchema } from './ask-question.schema';
import { Narrative, NarrativeSchema } from '../narratives/narrative.schema';

describeDb('Ask Claude lookups', () => {
  let conn: Connection;
  let Sim: Model<any>;
  let Firms: Model<any>;
  let Kpi: Model<any>;
  let Dec: Model<any>;
  let Close: Model<any>;
  let Log: Model<any>;
  let Enr: Model<any>;
  let Users: Model<any>;
  let svc: AskClaudeService;

  beforeAll(async () => {
    conn = await connectTestDb();
    Sim = conn.model(Simulation.name, SimulationSchema);
    Firms = conn.model(Firm.name, FirmSchema);
    Kpi = conn.model(KpiHistory.name, KpiHistorySchema);
    Dec = conn.model(Decision.name, DecisionSchema);
    Close = conn.model(QuarterCloseLog.name, QuarterCloseLogSchema);
    Log = conn.model(ForecastLog.name, ForecastLogSchema);
    Enr = conn.model(Enrollment.name, EnrollmentSchema);
    Users = conn.model(User.name, UserSchema);
  });
  afterAll(async () => {
    await closeTestDb(conn);
  });
  beforeEach(async () => {
    await clearTestDb(conn);
    svc = new AskClaudeService(
      new AiUseService(conn.model(AiCall.name, AiCallSchema) as any),
      conn.model(AskQuestion.name, AskQuestionSchema) as any,
      Sim as any,
      Firms as any,
      Dec as any,
      Kpi as any,
      Log as any,
      Enr as any,
      Close as any,
      conn.model(Narrative.name, NarrativeSchema) as any,
    );
  });

  async function seedCourse(name: string, secret: number) {
    const simId = new Types.ObjectId();
    await Sim.collection.insertOne({
      _id: simId,
      name,
      status: 'IN_PROGRESS',
      currentQuarter: 5,
      totalQuarters: 11,
      orientationQuarters: 2,
      timezone: 'America/New_York',
      quarterEndsAt: new Date('2026-10-30T03:59:00Z'),
      moduleSchedule: {
        mode: 'PROGRESSIVE',
        modules: [{ moduleId: 'ds', unlocksAtQuarter: 6, enabled: true }],
      },
    });
    const firms: Types.ObjectId[] = [];
    for (const n of [1, 2]) {
      const firmId = new Types.ObjectId();
      await Firms.collection.insertOne({
        _id: firmId,
        simulation: simId,
        firmNumber: n,
        name: `Firm ${n}`,
      });
      firms.push(firmId);
      const user = await Users.collection.insertOne({
        email: `student${secret}${n}@example.com`,
        firstName: `Secret${secret}${n}`,
        lastName: 'Person',
        role: 'STUDENT',
      });
      await Enr.collection.insertOne({
        simulation: simId,
        firm: firmId,
        user: user.insertedId,
        status: 'ACTIVE',
        paymentNotes: 'paid by cheque 4417',
      });
      for (const q of [3, 4]) {
        await Kpi.collection.insertOne({
          simulation: simId,
          firm: firmId,
          quarter: q,
          financial: {
            revenue: secret * 1000 + n,
            netIncome: 5,
            cash: 6,
            grossMarginPct: 35,
          },
          customer: { csi: 80, marketShare: 0.35, fillRate: 0.95 },
          operations: { perfectOrder: 0.9, capacityUtilization: 0.75 },
          bsc: {
            financial: 70,
            customer: 70,
            process: 70,
            learning: 70,
            overall: 70,
          },
        });
      }
    }
    await Close.collection.insertOne({
      simulationId: simId,
      course: name,
      quarter: 4,
      source: 'deadline',
      status: 'succeeded',
      startedAt: new Date('2026-10-30T03:59:30Z'),
      completedAt: new Date('2026-10-30T04:00:00Z'),
      seconds: 1.2,
      firms: 2,
      firmsSubmitted: 1,
      firmsCarriedForward: 1,
    });
    return { simId, firms, sim: (await Sim.findById(simId)) as any };
  }

  it("reads only this course: another course's firm is not found, and its figures never appear", async () => {
    const a = await seedCourse('Course A', 1);
    await seedCourse('Course B', 2);
    const tools = new AskClaudeTools(await svc.loadCourse(a.sim));
    const found = tools.run('get_results', {
      firms: ['Firm 2'],
      quarters: [4],
      measures: ['revenue'],
    });
    expect(JSON.stringify(found)).toContain('$1,002');
    expect(JSON.stringify(found)).not.toContain('2,00');
    expect(
      tools.run('get_firm_detail', { firm: 'Course B firm' }),
    ).toHaveProperty('error');
    const all = JSON.stringify([
      tools.run('get_course_status', {}),
      tools.run('get_close_history', {}),
      tools.run('get_results', {}),
      tools.run('get_firm_detail', { firm: 'Firm 1' }),
      tools.run('get_decisions', { firm: 'Firm 1', quarter: 4 }),
      tools.run('get_forecast_accuracy', {}),
    ]);
    expect(all).not.toContain('Course B');
  });

  it('never returns a student name, email or payment note', async () => {
    const a = await seedCourse('Course A', 1);
    const tools = new AskClaudeTools(await svc.loadCourse(a.sim));
    const all = JSON.stringify([
      tools.run('get_course_status', {}),
      tools.run('get_close_history', {}),
      tools.run('get_results', {}),
      tools.run('get_firm_detail', { firm: 'Firm 1' }),
      tools.run('get_decisions', { firm: 'Firm 1', quarter: 4 }),
      tools.run('get_forecast_accuracy', {}),
    ]);
    expect(all).not.toMatch(/Secret|Person|@example\.com|cheque|student1/);
    // A firm's members go over as a count.
    expect(tools.run('get_course_status', {}).firms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ firm: 'Firm 1', students: 1 }),
      ]),
    );
  });

  it('writes dates in course time with the zone', async () => {
    const a = await seedCourse('Course A', 1);
    const tools = new AskClaudeTools(
      await svc.loadCourse(a.sim),
      () => new Date('2026-10-28T12:00:00Z'),
    );
    const status = tools.run('get_course_status', {});
    // 03:59 UTC on 30 Oct is 11:59 PM EDT on 29 Oct.
    expect(status.open_quarter_closes).toBe('29 Oct 2026, 11:59 PM EDT');
    expect(
      (tools.run('get_close_history', {}).closes as any[])[0].closed_at,
    ).toBe('30 Oct 2026, 12:00 AM EDT');
  });

  it('writes figures the way the pages write them', async () => {
    const a = await seedCourse('Course A', 1);
    const tools = new AskClaudeTools(await svc.loadCourse(a.sim));
    const r = tools.run('get_results', { firms: ['Firm 1'], quarters: [4] });
    expect((r.results as any[])[0].quarters[0]).toMatchObject({
      Revenue: '$1,001',
      'Gross margin': '35.0%',
      'Market share': '35.0%',
      'Fill rate': '95.0%',
      'Customer satisfaction': '80',
    });
  });

  it('shows at most one table per answer', async () => {
    const a = await seedCourse('Course A', 1);
    const tools = new AskClaudeTools(await svc.loadCourse(a.sim));
    tools.run('show_table', { measures: ['revenue'] });
    tools.run('show_table', { measures: ['cash'] });
    expect(tools.views).toHaveLength(1);
  });
});
