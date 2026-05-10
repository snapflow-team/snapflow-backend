import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { unwrapPayload } from './rpc-envelope';

export const RpcPayload = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const raw: unknown = ctx.switchToRpc().getData<unknown>();

  return unwrapPayload(raw).data;
});
