import { BadRequestException } from '@nestjs/common';
import { Model, Types } from 'mongoose';

export const TEST_ACCOUNT_RULE = 'A test account can enrol only in a practice course.';

/** A test account may enrol only in a practice course. */
export function assertCanEnrol(
  user: { isTestAccount?: boolean } | null | undefined,
  simulation: { isPractice?: boolean } | null | undefined,
): void {
  if (user?.isTestAccount === true && simulation?.isPractice !== true) {
    throw new BadRequestException(TEST_ACCOUNT_RULE);
  }
}

/** The same rule, looking the user and the course up by id. */
export async function assertCanEnrolById(
  userModel: Model<any>,
  simulationModel: Model<any>,
  userId: Types.ObjectId | string,
  simulationId: Types.ObjectId | string,
): Promise<void> {
  const user = await userModel.findById(userId).select('isTestAccount').lean();
  if (!user || (user as any).isTestAccount !== true) return;
  const sim = await simulationModel.findById(simulationId).select('isPractice').lean();
  assertCanEnrol(user as any, sim as any);
}
