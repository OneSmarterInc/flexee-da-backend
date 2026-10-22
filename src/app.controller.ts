import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

// When this process started. Reported by /health so a reader can tell a
// fresh deploy from an old one.
const STARTED_AT = new Date().toISOString();

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * Public health check. `commit` is the deployed commit: GIT_COMMIT if the
   * deploy set it, otherwise the commit Vercel sets on its own builds
   * (VERCEL_GIT_COMMIT_SHA, shortened), otherwise "unknown".
   */
  @Get('health')
  getHealth(): {
    status: 'ok';
    sim: 'data_analytics';
    commit: string;
    startedAt: string;
  } {
    return {
      status: 'ok',
      sim: 'data_analytics',
      commit:
        process.env.GIT_COMMIT?.trim() ||
        process.env.VERCEL_GIT_COMMIT_SHA?.trim().slice(0, 7) ||
        'unknown',
      startedAt: STARTED_AT,
    };
  }
}
