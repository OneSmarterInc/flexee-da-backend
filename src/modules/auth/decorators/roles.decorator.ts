import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@/entities/index.entity';

export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);