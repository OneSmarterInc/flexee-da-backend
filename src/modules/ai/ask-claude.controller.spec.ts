/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument -- the controller is built with stubs */
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Types } from 'mongoose';
import { UserRole } from '../../entities/index.entity';
import { RolesGuard } from '../auth/guards/roles.guard';
import { assertCourseAccess } from '../simulation/course-access';
import { AskClaudeController, cleanDetails } from './ask-claude.controller';

const guard = new RolesGuard(new Reflector());
const as = (role: UserRole, handler: (...a: never[]) => unknown) =>
  ({
    getHandler: () => handler,
    switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
  }) as unknown as ExecutionContext;

describe('Ask Claude endpoints', () => {
  const proto = AskClaudeController.prototype;

  it.each([
    ['status', proto.status],
    ['question', proto.question],
    ['setSwitch', proto.setSwitch],
  ])(
    '%s: a student gets 403, faculty and admin are let in',
    (_name, handler) => {
      expect(() =>
        guard.canActivate(as(UserRole.STUDENT, handler as never)),
      ).toThrow(ForbiddenException);
      expect(guard.canActivate(as(UserRole.FACULTY, handler as never))).toBe(
        true,
      );
      expect(guard.canActivate(as(UserRole.ADMIN, handler as never))).toBe(
        true,
      );
    },
  );

  it('refuses faculty who are not on the course, with 403', async () => {
    const owner = new Types.ObjectId();
    const sim = { _id: new Types.ObjectId(), owner, facultyIds: [] };
    const controller = new AskClaudeController(
      {} as never,
      { findById: async () => sim } as never,
    );
    const stranger = { _id: new Types.ObjectId(), role: UserRole.FACULTY };
    await expect(
      controller.status(String(sim._id), { user: stranger }),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      controller.question(
        String(sim._id),
        {
          question: 'hi',
          conversationId: 'x',
          context: { page: 'course', label: 'Course' },
        } as never,
        { user: stranger },
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});

describe('assertCourseAccess', () => {
  const owner = new Types.ObjectId();
  const assigned = new Types.ObjectId();
  const sim = { owner, facultyIds: [assigned] };

  it('lets admin, the owner and an assigned faculty member in', () => {
    expect(() =>
      assertCourseAccess(
        { role: UserRole.ADMIN, _id: new Types.ObjectId() },
        sim,
      ),
    ).not.toThrow();
    expect(() =>
      assertCourseAccess({ role: UserRole.FACULTY, _id: owner }, sim),
    ).not.toThrow();
    expect(() =>
      assertCourseAccess({ role: UserRole.FACULTY, _id: assigned }, sim),
    ).not.toThrow();
  });

  it('refuses other faculty and students', () => {
    expect(() =>
      assertCourseAccess(
        { role: UserRole.FACULTY, _id: new Types.ObjectId() },
        sim,
      ),
    ).toThrow(ForbiddenException);
    expect(() =>
      assertCourseAccess({ role: UserRole.STUDENT, _id: owner }, sim),
    ).toThrow(ForbiddenException);
  });
});

describe('cleanDetails', () => {
  it('keeps at most 10 string entries, with keys up to 60 and values up to 200 characters', () => {
    const big = Object.fromEntries(
      Array.from({ length: 30 }, (_, i) => [
        `k${i}`.padEnd(80, 'x'),
        'v'.repeat(500),
      ]),
    );
    const clean = cleanDetails({ ...big, number: 5, nested: { a: 1 } });
    const entries = Object.entries(clean);
    expect(entries.length).toBe(10);
    for (const [k, v] of entries) {
      expect(k.length).toBeLessThanOrEqual(60);
      expect(v.length).toBeLessThanOrEqual(200);
    }
    expect(cleanDetails(undefined)).toEqual({});
    expect(cleanDetails([1, 2])).toEqual({});
    expect(cleanDetails({ quarter: '7' })).toEqual({ quarter: '7' });
  });
});
