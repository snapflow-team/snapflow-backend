import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../../../snapflow-core/src/modules/user-accounts/decorators/public.decorator';
import { UserContextDto } from '../../../../snapflow-core/src/modules/user-accounts/auth/domain/guards/dto/user-context.dto';
import { DomainExceptionCode } from '../../../../../libs/common/exceptions/types/domain-exception-codes';
import { DomainException } from '../../../../../libs/common/exceptions/damain.exception';

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
      throw new DomainException({
        code: DomainExceptionCode.Unauthorized,
        message: 'User is not authenticated',
      });
    }

    return user as TUser;
  }
}
