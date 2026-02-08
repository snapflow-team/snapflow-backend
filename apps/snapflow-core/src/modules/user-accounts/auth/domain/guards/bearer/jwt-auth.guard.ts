import { ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserContextDto } from '../dto/user-context.dto';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../../../decorators/public.decorator';
import { DomainException } from '../../../../../../../../../libs/common/exceptions/damain.exception';
import { ErrorCodes } from '../../../../../../../../../libs/common/exceptions/error-codes.enum';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic: boolean = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = UserContextDto>(err: any, user: any): TUser {
    if (err || !user) {
      throw new DomainException(ErrorCodes.UNAUTHORIZED, 'Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    return user as TUser;
  }
}
