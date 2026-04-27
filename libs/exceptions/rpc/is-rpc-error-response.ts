import { IRpcErrorResponse } from './rpc-exception-response';

type RpcErrorResponseShape = Partial<IRpcErrorResponse<unknown>>;

export const isRpcErrorResponse = (
  error: unknown,
  expectedService?: string,
): error is IRpcErrorResponse<unknown> => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const response = error as RpcErrorResponseShape;

  if (typeof response.timestamp !== 'string') {
    return false;
  }

  if (typeof response.service !== 'string') {
    return false;
  }

  if (expectedService && response.service !== expectedService) {
    return false;
  }

  if (response.pattern !== null && typeof response.pattern !== 'string') {
    return false;
  }

  if (typeof response.message !== 'string') {
    return false;
  }

  if (response.code === undefined || response.code === null) {
    return false;
  }

  if (!Array.isArray(response.extensions)) {
    return false;
  }

  return true;
};
