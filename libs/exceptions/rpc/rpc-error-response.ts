import { RpcExceptionCode } from './rpc-exteption-codes';

export interface RpcValidationError {
  field: string;
  message: string;
}

export interface RpcErrorDto {
  timestamp: string;
  message: string;
  code: RpcExceptionCode;
  validationErrors?: RpcValidationError[];
}
