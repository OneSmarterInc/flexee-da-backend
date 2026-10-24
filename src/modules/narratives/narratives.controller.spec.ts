/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument -- the controller is built with stubs */
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Types } from 'mongoose';
import { UserRole } from '../../entities/index.entity';
import { NarrativesController } from './narratives.controller';

describe('narratives endpoints: who can read what', () => {
  const owner = new Types.ObjectId();
  const myFirm = new Types.ObjectId();
  const otherFirm = new Types.ObjectId();
  const sim = { _id: new Types.ObjectId(), owner, facultyIds: [] };
  const calls: string[] = [];
  const service = {
    readings: async () => (calls.push('readings'), []),
    explanations: async (_s: unknown, firm: string, faculty: boolean) => (
      calls.push(`explanations:${firm}:${faculty}`),
      []
    ),
    debrief: async (_s: unknown, firm: string | null, faculty: boolean) => (
      calls.push(`debrief:${firm}:${faculty}`),
      { complete: true }
    ),
  };
  const enrollment = { firm: myFirm };
  const controller = new NarrativesController(
    service as never,
    { findById: async () => sim } as never,
    { findOne: async () => enrollment } as never,
  );
  const student = { _id: new Types.ObjectId(), role: UserRole.STUDENT };
  const faculty = { _id: owner, role: UserRole.FACULTY };
  const stranger = { _id: new Types.ObjectId(), role: UserRole.FACULTY };
  const id = String(sim._id);

  beforeEach(() => (calls.length = 0));

  it("a student reads their own firm's explanations, without the engine text", async () => {
    await controller.explanations(id, String(myFirm), { user: student });
    expect(calls).toEqual([`explanations:${myFirm}:false`]);
  });

  it("a student gets 403 for another firm's explanations", async () => {
    await expect(
      controller.explanations(id, String(otherFirm), { user: student }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("course faculty read any firm's explanations, with the engine text; other faculty get 403", async () => {
    await controller.explanations(id, String(otherFirm), { user: faculty });
    expect(calls).toEqual([`explanations:${otherFirm}:true`]);
    await expect(
      controller.explanations(id, String(otherFirm), { user: stranger }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('readings are for faculty: course faculty read them, other faculty get 403', async () => {
    await controller.readings(id, { user: faculty });
    expect(calls).toEqual(['readings']);
    await expect(controller.readings(id, { user: stranger })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("a student gets only their own firm's debrief; faculty get every firm", async () => {
    await controller.debrief(id, { user: student });
    await controller.debrief(id, { user: faculty });
    expect(calls).toEqual([`debrief:${myFirm}:false`, 'debrief:null:true']);
  });

  it('a student gets 403 on readings from the roles guard', () => {
    const guard = new RolesGuard(new Reflector());
    const as = (role: UserRole) =>
      ({
        getHandler: () => NarrativesController.prototype.readings,
        switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
      }) as unknown as ExecutionContext;
    expect(() => guard.canActivate(as(UserRole.STUDENT))).toThrow(
      ForbiddenException,
    );
    expect(guard.canActivate(as(UserRole.FACULTY))).toBe(true);
  });
});
