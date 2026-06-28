import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Request } from 'express';
import { ClientInfoDto } from '../../../../../../../../libs/common/dto/client-info.dto';

export const ExtractAdminClientInfo = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): ClientInfoDto => {
    const gqlContext: GqlExecutionContext = GqlExecutionContext.create(ctx);
    const request: Request = gqlContext.getContext<{ req: Request }>().req;

    const userAgent: string = request.headers['user-agent'] || '';
    const ip: string =
      request.headers['x-forwarded-for']?.toString().split(',')[0] ||
      request.socket.remoteAddress ||
      '0.0.0.0';

    return {
      ip,
      userAgent,
    };
  },
);
