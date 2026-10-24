import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../entities/index.entity';

/**
 * Admin, or faculty who own the course or are in its facultyIds. Everyone
 * else, students included, is refused. Used by Ask Claude and the faculty
 * forecast-accuracy view.
 */
export function assertCourseAccess(
  user: { _id?: unknown; id?: unknown; role?: string } | null | undefined,
  simulation: { owner?: unknown; facultyIds?: unknown[] } | null | undefined,
): void {
  const refuse = () =>
    new ForbiddenException('You do not have access to this simulation.');
  if (!user || !simulation) throw refuse();
  if (user.role === UserRole.ADMIN) return;
  if (user.role !== UserRole.FACULTY) throw refuse();
  const userId = String(user._id ?? user.id ?? '');
  const isOwner = String(simulation.owner ?? '') === userId;
  const isAssigned = (simulation.facultyIds ?? []).some(
    (id) => String(id) === userId,
  );
  if (!userId || (!isOwner && !isAssigned)) throw refuse();
}
