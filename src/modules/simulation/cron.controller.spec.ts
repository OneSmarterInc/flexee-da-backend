import {
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CronController } from './cron.controller';

describe('cron endpoint', () => {
  const saved = process.env.CRON_SECRET;
  const sweep = jest.fn().mockResolvedValue({
    advanced: 1,
    skipped: 0,
    failed: 0,
    remindersSent: 2,
  });
  const controller = new CronController({ sweep } as never);

  afterEach(() => {
    process.env.CRON_SECRET = saved;
    sweep.mockClear();
  });

  it('is off when CRON_SECRET is not set', async () => {
    delete process.env.CRON_SECRET;
    await expect(controller.quarterTickNow('Bearer anything')).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(sweep).not.toHaveBeenCalled();
  });

  it('refuses a missing or wrong token', async () => {
    process.env.CRON_SECRET = 'right-secret';
    await expect(controller.quarterTickNow(undefined)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(controller.quarterTickNow('Bearer wrong')).rejects.toThrow(
      ForbiddenException,
    );
    expect(sweep).not.toHaveBeenCalled();
  });

  it('runs the sweep with the right token', async () => {
    process.env.CRON_SECRET = 'right-secret';
    await expect(
      controller.quarterTickNow('Bearer right-secret'),
    ).resolves.toEqual({
      advanced: 1,
      skipped: 0,
      failed: 0,
      remindersSent: 2,
    });
    expect(sweep).toHaveBeenCalledTimes(1);
  });
});
