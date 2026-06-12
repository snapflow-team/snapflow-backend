import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class AdminGqlThrottlerGuard extends ThrottlerGuard {
  protected getRequestResponse(context: ExecutionContext) {
    if (context.getType<GqlContextType>() !== 'graphql') {
      return super.getRequestResponse(context);
    }

    const gqlContext: GqlExecutionContext = GqlExecutionContext.create(context);
    const ctx = gqlContext.getContext<{ req: Record<string, any>; res: Record<string, any> }>();

    return { req: ctx.req, res: ctx.res };
  }
}
