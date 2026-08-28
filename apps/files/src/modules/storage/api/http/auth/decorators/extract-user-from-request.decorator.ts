import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { UserContextDto } from '../dto/user-context.dto';

export const ExtractUserFromRequest = createParamDecorator(
  (_data: unknown, context: ExecutionContext): UserContextDto => {
    const request = context.switchToHttp().getRequest<Request & { user: UserContextDto }>();
    return request.user;
  },
);
