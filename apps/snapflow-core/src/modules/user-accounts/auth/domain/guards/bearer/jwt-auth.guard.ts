import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserContextDto } from '../dto/user-context.dto';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../../../decorators/public.decorator';
import { IS_OPTIONAL_AUTH_KEY } from '../../../../decorators/optional-auth.decorator';
import {
  ForbiddenException,
  UnauthorizedException,
} from '../../../../../../common/exceptions/domain-exceptions';
import { Request } from 'express';

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
    const isOptionalAuth: boolean = this.reflector.getAllAndOverride<boolean>(
      IS_OPTIONAL_AUTH_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic && !isOptionalAuth) {
      return true;
    }

    if (isPublic && isOptionalAuth) {
      const request = context.switchToHttp().getRequest<Request>();
      const hasAuthHeader = Boolean(request.headers?.authorization);

      if (!hasAuthHeader) {
        return true;
      }
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = UserContextDto>(
    err: any,
    user: any,
    _info: any,
    context: ExecutionContext,
  ): TUser {
    const isOptionalAuth: boolean = this.reflector.getAllAndOverride<boolean>(
      IS_OPTIONAL_AUTH_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (err instanceof ForbiddenException) {
      throw err;
    }

    if (isOptionalAuth) {
      if (err) {
        throw new UnauthorizedException('User is not authenticated');
      }

      return (user ?? null) as TUser;
    }

    if (err || !user) {
      throw new UnauthorizedException('User is not authenticated');
    }

    return user as TUser;
  }
}
