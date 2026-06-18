import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SessionContextDto } from '../dto/session-context.dto';
import {
  ForbiddenException,
  UnauthorizedException,
} from '../../../../../../common/exceptions/domain-exceptions';

@Injectable()
export class JwtRefreshAuthGuard extends AuthGuard('jwt-refresh') {
  handleRequest<TSession = SessionContextDto>(err: any, session: any): TSession {
    if (err instanceof ForbiddenException) {
      throw err;
    }

    if (err || !session) {
      throw new UnauthorizedException('User is not authenticated');
    }

    return session as TSession;
  }
}
