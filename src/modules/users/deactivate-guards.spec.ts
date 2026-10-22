/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- tests build services with only the models they use */
// Nobody can deactivate themselves or the last active admin.

import { BadRequestException } from '@nestjs/common';
import { Connection, Model, Types } from 'mongoose';
import {
  clearTestDb,
  connectTestDb,
  describeDb,
} from '../../../test/mongo-test-db';
import { User, UserRole, UserSchema } from '../../entities/index.entity';
import { UsersService } from './users.service';

describeDb('deactivate guards', () => {
  let conn: Connection;
  let UserModel: Model<any>;
  let svc: any;

  async function addUser(role: UserRole, isActive = true) {
    const _id = new Types.ObjectId();
    await UserModel.collection.insertOne({
      _id,
      email: `${_id.toHexString()}@example.test`,
      role,
      isActive,
    });
    return String(_id);
  }

  beforeAll(async () => {
    conn = await connectTestDb();
    UserModel = conn.model(User.name, UserSchema);
  });

  afterAll(async () => {
    await conn.close();
  });

  beforeEach(async () => {
    await clearTestDb(conn);
    svc = Object.create(UsersService.prototype);
    svc.userModel = UserModel;
  });

  it('refuses deactivating your own account', async () => {
    const a = await addUser(UserRole.ADMIN);
    await addUser(UserRole.ADMIN);
    await expect(svc.deactivateUser(a, a)).rejects.toThrow(BadRequestException);
  });

  it('refuses deactivating the last active admin', async () => {
    const a = await addUser(UserRole.ADMIN);
    await addUser(UserRole.ADMIN, false);
    const actor = await addUser(UserRole.FACULTY);
    await expect(svc.deactivateUser(a, actor)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('deactivates an admin when another active admin remains', async () => {
    const a = await addUser(UserRole.ADMIN);
    const b = await addUser(UserRole.ADMIN);
    await svc.deactivateUser(a, b);
    const after = await UserModel.findById(a).lean<any>();
    expect(after.isActive).toBe(false);
  });

  it('deactivates a student', async () => {
    const admin = await addUser(UserRole.ADMIN);
    const s = await addUser(UserRole.STUDENT);
    await svc.deactivateUser(s, admin);
    const after = await UserModel.findById(s).lean<any>();
    expect(after.isActive).toBe(false);
  });
});
