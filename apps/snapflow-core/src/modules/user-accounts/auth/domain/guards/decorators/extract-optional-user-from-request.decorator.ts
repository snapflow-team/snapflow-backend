import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserContextDto } from '../dto/user-context.dto';
import { Request } from 'express';

export const ExtractOptionalUserFromRequest = createParamDecorator(
  (data: unknown, context: ExecutionContext): UserContextDto | null => {
    const request: Request = context.switchToHttp().getRequest<Request>();

    return (request.user as UserContextDto | undefined) ?? null;
  },
);
