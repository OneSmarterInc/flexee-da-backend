// src/modules/simulation/cron.controller.ts
//
// The scheduled sweep as an HTTP endpoint, for hosts where a background
// timer doesn't run (Vercel serverless). Vercel's cron calls
// GET /api/cron/quarter-tick on the schedule in vercel.json and, when the
// CRON_SECRET environment variable is set, sends it as a bearer token.
// Without CRON_SECRET the endpoint refuses every call, so it is never open.

import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { timingSafeEqual } from 'crypto';
import { QuarterTickService, SweepResult } from './quarter-tick.service';

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

@ApiExcludeController()
@Controller('cron')
export class CronController {
  constructor(private readonly quarterTick: QuarterTickService) {}

  @Get('quarter-tick')
  async quarterTickNow(
    @Headers('authorization') authorization?: string,
  ): Promise<SweepResult> {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      throw new ServiceUnavailableException(
        'CRON_SECRET is not set, so the scheduled sweep is turned off.',
      );
    }
    if (!sameSecret(authorization ?? '', `Bearer ${secret}`)) {
      throw new ForbiddenException();
    }
    return this.quarterTick.sweep();
  }
}
