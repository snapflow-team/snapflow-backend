import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SessionContextDto } from '../dto/session-context.dto';
import { Request } from 'express';
import { DomainException } from '../../../../../../../../../libs/common/exceptions/damain.exception';
import { DomainExceptionCode } from '../../../../../../../../../libs/common/exceptions/types/domain-exception-codes';

export const ExtractSessionFromRequest = createParamDecorator(
  (data: unknown, context: ExecutionContext): SessionContextDto => {
    const request: Request = context.switchToHttp().getRequest<Request>();

    const session = request.user;

    if (!session) {
      throw new DomainException({
        code: DomainExceptionCode.Unauthorized,
        message: 'User is not authenticated',
      });
    }

    return session as SessionContextDto;
  },
);
