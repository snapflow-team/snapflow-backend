import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SessionContextDto } from '../dto/session-context.dto';
import { Request } from 'express';
import { UnauthorizedException } from '../../../../../../common/exceptions/domain-exceptions';

export const ExtractSessionFromRequest = createParamDecorator(
  (data: unknown, context: ExecutionContext): SessionContextDto => {
    const request: Request = context.switchToHttp().getRequest<Request>();

    const session = request.user;

    if (!session) {
      throw new UnauthorizedException('User is not authenticated');
    }

    return session as SessionContextDto;
  },
);
