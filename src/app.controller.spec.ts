import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    const saved = { ...process.env };
    afterEach(() => {
      process.env = { ...saved };
    });

    it('reports GIT_COMMIT when the deploy sets it', () => {
      process.env.GIT_COMMIT = 'abc1234';
      expect(appController.getHealth().commit).toBe('abc1234');
    });

    it("falls back to Vercel's commit, shortened", () => {
      delete process.env.GIT_COMMIT;
      process.env.VERCEL_GIT_COMMIT_SHA = 'e507dfa3adad884580b2';
      expect(appController.getHealth().commit).toBe('e507dfa');
    });

    it('says unknown when neither is set', () => {
      delete process.env.GIT_COMMIT;
      delete process.env.VERCEL_GIT_COMMIT_SHA;
      const h = appController.getHealth();
      expect(h).toMatchObject({
        status: 'ok',
        sim: 'data_analytics',
        commit: 'unknown',
      });
    });
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
