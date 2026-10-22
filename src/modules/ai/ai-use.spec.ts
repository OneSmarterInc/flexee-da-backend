/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- tests read raw documents */
// The house rules (V3 layer 4): every call logged with its cost, one monthly
// ceiling for the site, and a switch per course.

import { Connection, Model, Types } from 'mongoose';
import {
  clearTestDb,
  closeTestDb,
  connectTestDb,
  describeDb,
} from '../../../test/mongo-test-db';
import { AiCall, AiCallSchema } from './ai-use.schema';
import {
  AiUseService,
  aiSettings,
  callCost,
  monthStart,
} from './ai-use.service';

describe('AI settings and cost', () => {
  it('is off unless the provider and key are both set', () => {
    expect(aiSettings({}).available).toBe(false);
    expect(aiSettings({ ANTHROPIC_API_KEY: 'k' }).available).toBe(false);
    expect(
      aiSettings({ FLEXEE_LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k' })
        .available,
    ).toBe(true);
  });

  it('uses a $50 ceiling unless set, and ignores a bad value', () => {
    expect(aiSettings({}).ceilingUsd).toBe(50);
    expect(aiSettings({ FLEXEE_AI_MONTHLY_CEILING_USD: '20' }).ceilingUsd).toBe(
      20,
    );
    expect(aiSettings({ FLEXEE_AI_MONTHLY_CEILING_USD: '-5' }).ceilingUsd).toBe(
      50,
    );
    expect(aiSettings({ FLEXEE_AI_MONTHLY_CEILING_USD: 'x' }).ceilingUsd).toBe(
      50,
    );
  });

  it('prices a call from its tokens', () => {
    // 1,000 in at $1/M and 500 out at $5/M = $0.001 + $0.0025
    expect(
      callCost(
        { inputTokens: 1000, outputTokens: 500 },
        { inputUsdPerMTok: 1, outputUsdPerMTok: 5 },
      ),
    ).toBe(0.0035);
  });

  it('starts the month at midnight UTC on the 1st', () => {
    expect(monthStart(new Date('2026-10-22T03:00:00Z')).toISOString()).toBe(
      '2026-10-01T00:00:00.000Z',
    );
  });
});

describeDb('AI house rules', () => {
  let conn: Connection;
  let Calls: Model<any>;
  let svc: AiUseService;

  beforeAll(async () => {
    conn = await connectTestDb();
    Calls = conn.model(AiCall.name, AiCallSchema);
  });

  afterAll(async () => {
    await closeTestDb(conn);
  });

  beforeEach(async () => {
    await clearTestDb(conn);
    svc = new AiUseService(Calls as never);
    svc.settings = {
      available: true,
      model: 'claude-haiku-4-5',
      ceilingUsd: 1,
      inputUsdPerMTok: 1,
      outputUsdPerMTok: 5,
    };
  });

  it('logs each call with its cost', async () => {
    const sim = new Types.ObjectId();
    await svc.record({
      simulationId: sim,
      course: 'MIS 4400 Fall',
      feature: 'ask_claude',
      outcome: 'kept',
      inputTokens: 2000,
      outputTokens: 400,
    });
    const row = await Calls.findOne({}).lean<any>();
    expect(row).toMatchObject({
      course: 'MIS 4400 Fall',
      feature: 'ask_claude',
      outcome: 'kept',
      model: 'claude-haiku-4-5',
      costUsd: 0.004,
    });
    expect(String(row.simulationId)).toBe(String(sim));
  });

  it('turns every course off once the month reaches the ceiling', async () => {
    await expect(svc.state({ aiEnabled: true })).resolves.toBe('on');
    // $1.00 of output tokens at $5/M = 200,000 tokens
    await svc.record({
      simulationId: null,
      course: null,
      feature: 'readings',
      outcome: 'kept',
      inputTokens: 0,
      outputTokens: 200_000,
    });
    await expect(svc.state({ aiEnabled: true })).resolves.toBe('off_ceiling');
  });

  it("doesn't count last month's spend toward this month", async () => {
    await Calls.collection.insertOne({
      feature: 'readings',
      model: 'm',
      outcome: 'kept',
      costUsd: 5,
      createdAt: new Date(Date.UTC(2026, 8, 30)),
    });
    await expect(svc.siteSpend(new Date(Date.UTC(2026, 9, 2)))).resolves.toBe(
      0,
    );
  });

  it("honors a course's switch, and reports a site with no key as unavailable", async () => {
    await expect(svc.state({ aiEnabled: false })).resolves.toBe('off_switch');
    svc.settings = { ...svc.settings, available: false };
    await expect(svc.state({ aiEnabled: true })).resolves.toBe('unavailable');
  });

  it('never throws when logging fails', async () => {
    const broken = new AiUseService({
      create: () => Promise.reject(new Error('down')),
    } as never);
    await expect(
      broken.record({
        simulationId: null,
        course: null,
        feature: 'ask_claude',
        outcome: 'error',
        inputTokens: 0,
        outputTokens: 0,
      }),
    ).resolves.toBeUndefined();
  });
});
