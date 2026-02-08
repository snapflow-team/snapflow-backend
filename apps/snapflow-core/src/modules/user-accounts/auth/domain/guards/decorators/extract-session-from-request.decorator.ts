import { createParamDecorator, ExecutionContext, HttpStatus } from '@nestjs/common';
import { SessionContextDto } from '../dto/session-context.dto';
import { Request } from 'express';
import { DomainException } from '../../../../../../../../../libs/common/exceptions/damain.exception';
import { ErrorCodes } from '../../../../../../../../../libs/common/exceptions/error-codes.enum';

//todo: переписать exceptions на транспортный слой
export const ExtractSessionFromRequest = createParamDecorator(
  (data: unknown, context: ExecutionContext): SessionContextDto => {
    const request: Request = context.switchToHttp().getRequest<Request>();

    const session = request.user;

    if (!session) {
      throw new DomainException(
        ErrorCodes.UNAUTHORIZED,
        'User is not authenticated',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return session as SessionContextDto;
  },
);
