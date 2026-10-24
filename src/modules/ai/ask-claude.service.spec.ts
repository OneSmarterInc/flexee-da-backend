/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument -- the service is built with only the models it uses */
// Ask Claude: the question loop with a fake Claude. No test calls Anthropic.

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
} from '../../entities/index.entity';
import {
  QuarterCloseLog,
  QuarterCloseLogSchema,
} from '../reporting/reporting.schemas';
import { AiCall, AiCallSchema } from './ai-use.schema';
import { AiUseService } from './ai-use.service';
import {
  AskClaudeService,
  AskRefused,
  EARLIER,
  REFUSALS,
  askSettings,
} from './ask-claude.service';
import { AskQuestion, AskQuestionSchema } from './ask-question.schema';
import { Narrative, NarrativeSchema } from '../narratives/narrative.schema';

const text = (t: string) => ({
  content: [{ type: 'text', text: t }],
  stop_reason: 'end_turn',
});
const lookup = (name: string, input: unknown = []) => ({
  content: [
    { type: 'thinking', thinking: '…', signature: 's' },
    { type: 'tool_use', id: `tu_${name}`, name, input },
  ],
  stop_reason: 'tool_use',
});

describeDb('Ask Claude service', () => {
  let conn: Connection;
  let Sim: Model<any>;
  let Calls: Model<any>;
  let Asked: Model<any>;
  let Firms: Model<any>;
  let Dec: Model<any>;
  let ai: AiUseService;
  let svc: AskClaudeService;
  let bodies: any[];
  let replies: any[];
  const user = new Types.ObjectId().toString();
  const page = { page: 'course', label: 'Course' };

  beforeAll(async () => {
    conn = await connectTestDb();
    Sim = conn.model(Simulation.name, SimulationSchema);
    Calls = conn.model(AiCall.name, AiCallSchema);
    Asked = conn.model(AskQuestion.name, AskQuestionSchema);
    Firms = conn.model(Firm.name, FirmSchema);
    Dec = conn.model(Decision.name, DecisionSchema);
  });
  afterAll(async () => {
    await closeTestDb(conn);
  });

  beforeEach(async () => {
    await clearTestDb(conn);
    ai = new AiUseService(Calls as any);
    ai.settings = {
      available: true,
      model: 'claude-haiku-4-5',
      ceilingUsd: 1000,
      inputUsdPerMTok: 1,
      outputUsdPerMTok: 5,
    };
    svc = new AskClaudeService(
      ai,
      Asked as any,
      Sim as any,
      Firms as any,
      Dec as any,
      conn.model(KpiHistory.name, KpiHistorySchema) as any,
      conn.model(ForecastLog.name, ForecastLogSchema) as any,
      conn.model(Enrollment.name, EnrollmentSchema) as any,
      conn.model(QuarterCloseLog.name, QuarterCloseLogSchema) as any,
      conn.model(Narrative.name, NarrativeSchema) as any,
    );
    svc.settings = {
      ...askSettings({
        FLEXEE_LLM_PROVIDER: 'anthropic',
        ANTHROPIC_API_KEY: 'k',
      }),
      url: 'https://claude.test/v1/messages',
    };
    bodies = [];
    replies = [];
    svc.send = jest.fn(
      async (_page: string, _tools: unknown, messages: unknown[]) => {
        bodies.push(JSON.parse(JSON.stringify(messages)));
        const next = replies.shift();
        if (next instanceof Error) throw next;
        return {
          usage: { input_tokens: 1000, output_tokens: 100 },
          stop_reason: 'end_turn',
          ...next,
        };
      },
    ) as any;
  });

  async function course(extra: Record<string, unknown> = {}) {
    const _id = new Types.ObjectId();
    await Sim.collection.insertOne({
      _id,
      name: 'Spring 2027',
      status: 'IN_PROGRESS',
      currentQuarter: 5,
      totalQuarters: 11,
      orientationQuarters: 2,
      timezone: 'America/New_York',
      quarterEndsAt: new Date(Date.now() + 2 * 86_400_000),
      moduleSchedule: { mode: 'PROGRESSIVE', modules: [] },
      ...extra,
    });
    await Firms.collection.insertOne({
      _id: new Types.ObjectId(),
      simulation: _id,
      firmNumber: 1,
      name: 'Firm 1',
    });
    return (await Sim.findById(_id)) as any;
  }
  const ask = (
    sim: any,
    question = 'Where does the course stand?',
    conversationId = '6f0c2f5e-3c7a-4d3e-9d6e-1b2c3d4e5f60',
  ) =>
    svc.ask({
      userId: user,
      simulation: sim,
      context: page,
      question,
      conversationId,
    });

  it('sends back a reply that only announces lookups, once, then answers and checks figures', async () => {
    const sim = await course();
    replies.push(
      text("I'll look at where the course stands."),
      lookup('get_course_status'),
      text(
        'Quarter 5 of 11 is open and Firm 1 has nothing saved yet. About 9,413 students are enrolled.',
      ),
    );
    const r = await ask(sim);
    expect(bodies[1]).toEqual(
      expect.arrayContaining([
        {
          role: 'user',
          content: 'Go ahead: use the lookups now, then answer the question.',
        },
      ]),
    );
    // The lookup's empty input went back as {}.
    const replayed = bodies[2].find(
      (m: any) =>
        m.role === 'assistant' &&
        Array.isArray(m.content) &&
        m.content.some((b: any) => b.type === 'tool_use'),
    );
    expect(
      replayed.content.find((b: any) => b.type === 'tool_use').input,
    ).toEqual({});
    expect(r.answer).toBe(
      'Quarter 5 of 11 is open and Firm 1 has nothing saved yet.',
    );
    expect(r.dropped).toEqual([
      { sentence: 'About 9,413 students are enrolled.', figures: ['9,413'] },
    ]);
    expect(r.lookups).toEqual([
      {
        name: 'get_course_status',
        summary: 'where the course stands: Quarter 5 open',
      },
    ]);
    expect(r.questionsLeft).toBe(99);
    const row = await Asked.findOne({ _id: { $exists: true } }).lean();
    expect(row).toMatchObject({
      status: 'answered',
      model: 'claude-sonnet-5-5',
      inputTokens: 3000,
      outputTokens: 300,
      page: 'course',
    });
  });

  it('writes one ai_calls row with the Ask model, summed tokens and the Ask prices', async () => {
    const sim = await course();
    replies.push(lookup('get_course_status'), text('Quarter 5 is open.'));
    await ask(sim);
    const calls = await Calls.find({}).lean();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      feature: 'ask_claude',
      model: 'claude-sonnet-5-5',
      outcome: 'kept',
      inputTokens: 2000,
      outputTokens: 200,
    });
    // 2000 in at $2/M plus 200 out at $10/M.
    expect(calls[0].costUsd).toBeCloseTo(0.006, 6);
  });

  it('records an answer with a dropped sentence as checks_failed', async () => {
    const sim = await course();
    replies.push(text('Quarter 5 is open. Firm 1 made $9,999,999 profit.'));
    await ask(sim);
    const call: any = await Calls.findOne({}).lean();
    expect(call.outcome).toBe('checks_failed');
    expect(call.sentencesDropped).toBe(1);
  });

  it('shows the all-dropped line when every sentence was dropped', async () => {
    const sim = await course();
    replies.push(text('Revenue was $9,999,999. Net income was $8,888,888.'));
    const r = await ask(sim);
    expect(r.answer).toBe(REFUSALS.allDropped);
  });

  it('refuses when the site ceiling is reached, without calling Claude', async () => {
    const sim = await course();
    ai.settings.ceilingUsd = 0.01;
    await Calls.create({
      feature: 'readings',
      model: 'm',
      outcome: 'kept',
      costUsd: 5,
    });
    await expect(ask(sim)).rejects.toMatchObject({
      message: REFUSALS.off_ceiling,
    });
    expect(svc.send).not.toHaveBeenCalled();
  });

  it('refuses when the course switch is off, without calling Claude', async () => {
    const sim = await course({ aiEnabled: false });
    await expect(ask(sim)).rejects.toMatchObject({
      message: REFUSALS.off_switch,
    });
    expect(svc.send).not.toHaveBeenCalled();
  });

  it('refuses when the site is not set up', async () => {
    const sim = await course();
    ai.settings.available = false;
    await expect(ask(sim)).rejects.toMatchObject({
      message: REFUSALS.unavailable,
    });
    expect(svc.send).not.toHaveBeenCalled();
  });

  it('refuses an empty or too long question', async () => {
    const sim = await course();
    await expect(ask(sim, '   ')).rejects.toMatchObject({
      message: REFUSALS.length,
    });
    await expect(ask(sim, 'x'.repeat(1001))).rejects.toMatchObject({
      message: REFUSALS.length,
    });
    expect(svc.send).not.toHaveBeenCalled();
  });

  it('refuses once the course has used its allowance, and uses a per-course allowance when set', async () => {
    const sim = await course({ askQuestionsPerMonth: 1 });
    replies.push(text('Quarter 5 is open.'));
    await ask(sim);
    await expect(ask(sim)).rejects.toMatchObject({
      message: REFUSALS.allowance,
    });
  });

  it('answers a 503 and records a failed question when Claude cannot be reached', async () => {
    const sim = await course();
    replies.push(new Error('network down'));
    const error = await ask(sim).catch((e) => e);
    expect(error).toBeInstanceOf(AskRefused);
    expect(error.unreachable).toBe(true);
    expect(error.message).toBe(REFUSALS.unreachable);
    const row: any = await Asked.findOne({}).lean();
    expect(row.status).toBe('failed');
    // A failed question was still spent.
    const call: any = await Calls.findOne({}).lean();
    expect(call.outcome).toBe('error');
    // A failed question does not use up the allowance.
    expect(await svc.questionsLeft(sim._id, sim)).toBe(100);
  });

  it('carries the last answered turns of a conversation, treated as checked', async () => {
    const sim = await course();
    const conversationId = '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed';
    replies.push(text('Quarter 5 is open.'));
    const first = await ask(sim, 'What is open?', conversationId);
    replies.push(text('Yes, still Quarter 5.'));
    await ask(sim, 'Still?', conversationId);
    expect(bodies[1]).toEqual([
      { role: 'user', content: 'What is open?' },
      { role: 'assistant', content: first.answer },
      { role: 'user', content: 'Still?' },
    ]);
    expect(EARLIER).toContain('checked');
  });

  it('keeps the answer when recording fails', async () => {
    const sim = await course();
    jest.spyOn(Asked, 'create').mockRejectedValueOnce(new Error('disk full'));
    replies.push(text('Quarter 5 is open.'));
    await expect(ask(sim)).resolves.toMatchObject({
      answer: 'Quarter 5 is open.',
    });
  });
});
