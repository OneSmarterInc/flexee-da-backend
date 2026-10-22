/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument -- HTTP bodies in tests */
// The reporting connector end to end, against the whole app: discovery,
// registration, an admin's approval, the token exchange, every tool, refresh
// rotation and revoke. Uses MONGODB_URI (a throwaway database in CI).

import { createHash, randomBytes } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import jwt from 'jsonwebtoken';
import { Model, Types } from 'mongoose';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import {
  Simulation,
  SimulationStatus,
  User,
  UserRole,
} from './../src/entities/index.entity';
import { TOOLS } from './../src/modules/reporting/reporting-views.service';

const REDIRECT = 'https://claude.ai/api/mcp/auth_callback';

describe('Reporting connector (e2e)', () => {
  let app: INestApplication<App>;
  let http: App;
  let users: Model<any>;
  let sims: Model<any>;
  let adminJwt: string;
  let studentJwt: string;

  const sign = (u: { _id: Types.ObjectId; role: string; email: string }) =>
    jwt.sign(
      { sub: String(u._id), role: u.role, email: u.email },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' },
    );

  async function addUser(role: UserRole) {
    const _id = new Types.ObjectId();
    const email = `${_id.toHexString()}@example.test`;
    await users.collection.insertOne({
      _id,
      email,
      role,
      isActive: true,
      firstName: 'T',
      lastName: 'U',
    });
    return sign({ _id, role, email });
  }

  /** Register, approve as admin, exchange: returns the token response. */
  async function connect() {
    const reg = await request(http)
      .post('/api/oauth/reporting/register')
      .send({ redirect_uris: [REDIRECT], client_name: 'Claude' })
      .expect(201);
    const clientId = reg.body.client_id as string;
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const auth = {
      client_id: clientId,
      redirect_uri: REDIRECT,
      response_type: 'code',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      scope: 'reporting:read',
      state: 'xyz',
    };
    const check = await request(http)
      .get('/api/oauth/reporting/check')
      .query(auth)
      .set('Authorization', `Bearer ${adminJwt}`)
      .expect(200);
    expect(check.body).toMatchObject({ ok: true, client: 'Claude' });
    const approve = await request(http)
      .post('/api/oauth/reporting/approve')
      .set('Authorization', `Bearer ${adminJwt}`)
      .send(auth)
      .expect(200);
    const back = new URL(approve.body.redirect as string);
    expect(back.searchParams.get('state')).toBe('xyz');
    const code = back.searchParams.get('code')!;
    // Real clients send the token request form-encoded.
    const tok = await request(http)
      .post('/api/oauth/reporting/token')
      .type('form')
      .send({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        redirect_uri: REDIRECT,
        code_verifier: verifier,
      })
      .expect(200);
    return { clientId, code, verifier, ...tok.body } as {
      clientId: string;
      code: string;
      verifier: string;
      access_token: string;
      refresh_token: string;
    };
  }

  const rpc = (token: string, method: string, params: object = {}) =>
    request(http)
      .post('/api/mcp/reporting')
      .set('Authorization', `Bearer ${token}`)
      .send({ jsonrpc: '2.0', id: 1, method, params });

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'e2e-only';
    process.env.CRON_QUARTER_TICK_ENABLED = 'false';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    http = app.getHttpServer();
    users = app.get(getModelToken(User.name));
    sims = app.get(getModelToken(Simulation.name));
    // A clean database, so the counts below are this test's own.
    await sims.db.dropDatabase();
    adminJwt = await addUser(UserRole.ADMIN);
    studentJwt = await addUser(UserRole.STUDENT);
    await sims.collection.insertOne({
      name: 'Reporting e2e course',
      institutionName: 'Test U',
      status: SimulationStatus.IN_PROGRESS,
      currentQuarter: 5,
      totalQuarters: 11,
      timezone: 'America/New_York',
      quarterStartedAt: new Date(Date.now() - 86_400_000),
      quarterEndsAt: new Date(Date.now() + 86_400_000),
      deployedForStudentAt: new Date(),
      createdAt: new Date(),
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves discovery at the host root, outside /api', async () => {
    const res = await request(http)
      .get('/.well-known/oauth-authorization-server')
      .expect(200);
    expect(res.body.token_endpoint).toMatch(/\/api\/oauth\/reporting\/token$/);
    await request(http)
      .get('/.well-known/oauth-protected-resource/api/mcp/reporting')
      .expect(200);
  });

  it('answers 401 with a pointer to the metadata when there is no token', async () => {
    const res = await request(http)
      .post('/api/mcp/reporting')
      .send({ jsonrpc: '2.0', id: 1, method: 'ping' })
      .expect(401);
    expect(res.headers['www-authenticate']).toMatch(
      /resource_metadata=".*\/\.well-known\/oauth-protected-resource\/api\/mcp\/reporting"/,
    );
  });

  it('lets only admins see the sign-in check', async () => {
    await request(http)
      .get('/api/oauth/reporting/check')
      .set('Authorization', `Bearer ${studentJwt}`)
      .expect(403);
  });

  it('refuses a registration that returns anywhere but Claude', async () => {
    await request(http)
      .post('/api/oauth/reporting/register')
      .send({ redirect_uris: ['https://evil.example/cb'] })
      .expect(400);
  });

  it('connects an admin and answers every tool with the contract columns', async () => {
    const t = await connect();
    const init = await rpc(t.access_token, 'initialize', {
      protocolVersion: '2025-06-18',
    }).expect(200);
    expect(init.body.result.protocolVersion).toBe('2025-06-18');
    const list = await rpc(t.access_token, 'tools/list').expect(200);
    expect(list.body.result.tools).toHaveLength(6);

    for (const name of Object.keys(TOOLS)) {
      const res = await rpc(t.access_token, 'tools/call', { name }).expect(200);
      const result = res.body.result;
      expect([name, result.isError]).toEqual([name, false]);
      const rows = result.structuredContent.rows as Array<
        Record<string, unknown>
      >;
      expect(JSON.parse(result.content[0].text)).toEqual({ rows });
      for (const row of rows) {
        expect([name, Object.keys(row)]).toEqual([
          name,
          Object.keys(TOOLS[name].columns),
        ]);
        expect(row.sim).toBe('data_analytics');
      }
    }

    const courses = await rpc(t.access_token, 'tools/call', {
      name: 'report_courses',
    });
    const course = courses.body.result.structuredContent.rows.find(
      (r: any) => r.course === 'Reporting e2e course',
    );
    expect(course).toMatchObject({
      status: 'running',
      quarter_now: 5,
      quarters: 11,
      institution: 'Test U',
    });
    const quarters = await rpc(t.access_token, 'tools/call', {
      name: 'report_quarters',
    });
    const q = (n: number) =>
      quarters.body.result.structuredContent.rows.find(
        (r: any) => r.course === 'Reporting e2e course' && r.quarter === n,
      );
    expect(q(1)).toMatchObject({ warm_up: true, state: 'closed' });
    expect(q(4)).toMatchObject({ warm_up: false, state: 'closed' });
    expect(q(5)).toMatchObject({
      state: 'open',
      overdue: false,
      firms_submitted: 0,
    });
    expect(q(5).deadline_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(q(6)).toMatchObject({ state: 'locked', deadline_at: null });

    const health = await rpc(t.access_token, 'tools/call', {
      name: 'report_health',
    });
    expect(health.body.result.structuredContent.rows[0]).toMatchObject({
      contract: 'v1',
      courses_running: 1,
      connections_active: 1,
    });
  });

  it('uses a code once, rotates refresh tokens, and stops after revoke', async () => {
    const t = await connect();

    const reuse = await request(http)
      .post('/api/oauth/reporting/token')
      .type('form')
      .send({
        grant_type: 'authorization_code',
        code: t.code,
        client_id: t.clientId,
        code_verifier: t.verifier,
      })
      .expect(400);
    expect(reuse.body.error).toBe('invalid_grant');

    const r1 = await request(http)
      .post('/api/oauth/reporting/token')
      .type('form')
      .send({
        grant_type: 'refresh_token',
        refresh_token: t.refresh_token,
        client_id: t.clientId,
      })
      .expect(200);
    await rpc(r1.body.access_token, 'ping').expect(200);
    await rpc(t.access_token, 'ping').expect(401); // old access token replaced
    await request(http)
      .post('/api/oauth/reporting/token')
      .type('form')
      .send({
        grant_type: 'refresh_token',
        refresh_token: t.refresh_token,
        client_id: t.clientId,
      })
      .expect(400); // old refresh token used up

    const list = await request(http)
      .get('/api/admin/reporting')
      .set('Authorization', `Bearer ${adminJwt}`)
      .expect(200);
    const mine = list.body.connections.find((c: any) => c.active);
    expect(mine).toBeDefined();
    for (const c of list.body.connections.filter((x: any) => x.active)) {
      await request(http)
        .post(`/api/admin/reporting/connections/${c.id}/revoke`)
        .set('Authorization', `Bearer ${adminJwt}`)
        .expect(200);
    }
    await rpc(r1.body.access_token, 'ping').expect(401);
  });
});
