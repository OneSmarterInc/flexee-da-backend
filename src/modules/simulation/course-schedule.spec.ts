/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- calls private methods on a bare service */
// The course time zone is required, and the schedule uses it.

import { BadRequestException } from '@nestjs/common';
import { formatCourseDateTime } from '../../lib/courseTime';
import { SimulationService } from './simulation.service';

describe('course schedule', () => {
  const svc: any = Object.create(SimulationService.prototype);

  it('refuses a course with no time zone', async () => {
    await expect(svc.create('u1', { name: 'No zone' })).rejects.toThrow(
      'Choose the time zone the course runs in. Quarter deadlines use it.',
    );
  });

  it('refuses a time zone it does not know', async () => {
    await expect(
      svc.create('u1', { name: 'Bad zone', timezone: 'Eastern' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('ends every quarter at 11:59 PM course time, back to back', () => {
    const tz = 'America/New_York';
    const schedule = svc.generateQuarterSchedule(
      3,
      14,
      new Date('2026-10-07T13:15:00Z'),
      tz,
    );
    expect(
      schedule.map((q: any) => formatCourseDateTime(q.plannedEndAt, tz)),
    ).toEqual([
      '21 Oct 2026, 11:59 PM EDT',
      '4 Nov 2026, 11:59 PM EST',
      '18 Nov 2026, 11:59 PM EST',
    ]);
    // Each quarter opens when the one before it closes.
    expect(schedule[1].plannedStartAt).toEqual(schedule[0].plannedEndAt);
  });
});
