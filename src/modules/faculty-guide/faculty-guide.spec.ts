/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument -- the preset builder is private and read through the prototype */
// The faculty guide is what Ask Claude quotes. These tests keep it equal to
// the Markdown file and to the rules the code applies.

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { readFileSync } from 'fs';
import { join } from 'path';
import { SchedulePreset, UserRole } from '../../entities/index.entity';
import { QUARTER_CLOSE_LOCAL } from '../../lib/courseTime';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FACULTY_GUIDE } from '../ai/faculty-guide';
import { SimulationService } from '../simulation/simulation.service';
import { FacultyGuideController } from './faculty-guide.controller';

const MD = readFileSync(
  join(__dirname, '../../../docs/faculty-guide.md'),
  'utf8',
).replace(/\r\n/g, '\n');

describe('faculty guide text', () => {
  it('equals docs/faculty-guide.md (run `npm run guide:sync` after editing it)', () => {
    expect(FACULTY_GUIDE).toBe(MD);
  });
});

const PRESET_BY_NAME: Record<string, SchedulePreset> = {
  'Basic supply chain': SchedulePreset.BASIC_SCM,
  'Short course': SchedulePreset.SHORT_COURSE,
  'Standard course': SchedulePreset.STANDARD_COURSE,
  'Long course': SchedulePreset.LONG_COURSE,
};
const MODULE_ORDER = ['ds', 'sa', 'ci', 'nd', 'pi', 'me'];

function presetTable() {
  const rows = MD.split('\n').filter((l) => /^\| (Basic|Short|Standard|Long) /.test(l));
  return rows.map((line) => {
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    return { name: cells[0], orientation: Number(cells[1]), unlocks: cells.slice(2) };
  });
}

describe('faculty guide schedule presets', () => {
  const svc: any = Object.create(SimulationService.prototype);

  it('lists all four presets', () => {
    expect(presetTable().map((r) => r.name)).toEqual(Object.keys(PRESET_BY_NAME));
  });

  it.each(Object.keys(PRESET_BY_NAME))('%s matches buildPresetSchedule()', (name) => {
    const row = presetTable().find((r) => r.name === name)!;
    // 30 quarters, so no module is cut off by the course length.
    const built = svc.buildPresetSchedule(PRESET_BY_NAME[name], 30);
    expect(row.orientation).toBe(built.orientationQuarters);
    const actual = MODULE_ORDER.map((id) => {
      const m = built.moduleSchedule.modules.find((x: any) => x.moduleId === id);
      return m.enabled ? `Q${m.unlocksAtQuarter}` : 'not used';
    });
    expect(row.unlocks).toEqual(actual);
  });
});

describe('faculty guide deadline', () => {
  it('states the close time the code uses', () => {
    const { hour, minute } = QUARTER_CLOSE_LOCAL;
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    const text = `${h12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
    expect(MD).toContain(text);
  });
});

describe('faculty guide endpoint', () => {
  const guard = new RolesGuard(new Reflector());
  const handler = FacultyGuideController.prototype.get;
  const as = (role: UserRole) =>
    ({
      getHandler: () => handler,
      switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
    }) as unknown as ExecutionContext;

  it('lets faculty and admin in', () => {
    expect(guard.canActivate(as(UserRole.FACULTY))).toBe(true);
    expect(guard.canActivate(as(UserRole.ADMIN))).toBe(true);
  });

  it('refuses a student', () => {
    expect(() => guard.canActivate(as(UserRole.STUDENT))).toThrow(ForbiddenException);
  });

  it('returns the guide text', () => {
    expect(new FacultyGuideController().get()).toBe(FACULTY_GUIDE);
  });
});
