import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SessionContextDto } from '../dto/session-context.dto';
import { DomainException } from '../../../../../../../../../libs/common/exceptions/damain.exception';
import { DomainExceptionCode } from '../../../../../../../../../libs/common/exceptions/types/domain-exception-codes';

@Injectable()
export class JwtRefreshAuthGuard extends AuthGuard('jwt-refresh') {
  handleRequest<TSession = SessionContextDto>(err: any, session: any): TSession {
    if (err || !session) {
      throw new DomainException({
        code: DomainExceptionCode.Unauthorized,
        message: 'User is not authenticated',
      });
    }

    return session as TSession;
  }
}
