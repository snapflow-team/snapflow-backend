import { HttpStatus, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SessionContextDto } from '../dto/session-context.dto';
import { DomainException } from '../../../../../../../../../libs/common/exceptions/damain.exception';
import { ErrorCodes } from '../../../../../../../../../libs/common/exceptions/error-codes.enum';

//todo: переписать exceptions на транспортный слой
@Injectable()
export class JwtRefreshAuthGuard extends AuthGuard('jwt-refresh') {
  handleRequest<TSession = SessionContextDto>(err: any, session: any): TSession {
    if (err || !session) {
      throw new DomainException(
        ErrorCodes.UNAUTHORIZED,
        'User is not authenticated',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return session as TSession;
  }
}
