import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '@/entities/index.entity';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as User;
  },
);