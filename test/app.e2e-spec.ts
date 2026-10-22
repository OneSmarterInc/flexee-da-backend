// Boots the whole backend against the test database (MONGODB_URI) and calls
// two public endpoints. If this fails, the app can't start.

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';

describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api answers', () => {
    return request(app.getHttpServer())
      .get('/api')
      .expect(200)
      .expect('Hello World!');
  });

  it('GET /api/health reports the sim and a commit', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);
    expect(res.body).toMatchObject({ status: 'ok', sim: 'data_analytics' });
    expect(typeof res.body.commit).toBe('string');
  });

  it('GET /api/cron/quarter-tick is public but refuses calls without the secret', async () => {
    const saved = process.env.CRON_SECRET;
    process.env.CRON_SECRET = 'e2e-secret';
    try {
      await request(app.getHttpServer())
        .get('/api/cron/quarter-tick')
        .expect(403);
      const res = await request(app.getHttpServer())
        .get('/api/cron/quarter-tick')
        .set('Authorization', 'Bearer e2e-secret')
        .expect(200);
      expect(res.body).toMatchObject({ advanced: 0, remindersSent: 0 });
    } finally {
      process.env.CRON_SECRET = saved;
    }
  });
});
