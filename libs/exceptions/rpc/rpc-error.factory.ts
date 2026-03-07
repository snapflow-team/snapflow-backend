import { RpcErrorDto } from './rpc-error-response';
import { ValidationError } from '@nestjs/common';
import { RpcExceptionCode } from './rpc-exteption-codes';
import { formatRpcValidationErrors } from './format-rpc-validation-errors';

export const createRpcValidationError = (errors: ValidationError[]): RpcErrorDto => ({
  timestamp: new Date().toISOString(),
  message: 'Validation failed',
  code: RpcExceptionCode.ValidationError,
  validationErrors: formatRpcValidationErrors(errors),
});

export const createRpcDomainError = (code: RpcExceptionCode, message: string): RpcErrorDto => ({
  timestamp: new Date().toISOString(),
  message,
  code,
});

export const createRpcInternalError = (message: string = 'Internal server error'): RpcErrorDto => ({
  timestamp: new Date().toISOString(),
  message,
  code: RpcExceptionCode.InternalError,
});
