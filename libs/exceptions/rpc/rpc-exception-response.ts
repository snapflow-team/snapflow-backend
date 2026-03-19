import {
  CommonDomainExceptionCode,
  CommonDomainExceptionCodeType,
  DomainException,
  IExtension,
} from '../core';

export interface IRpcErrorResponse<TCode = CommonDomainExceptionCodeType> {
  timestamp: string;
  service: symbol;
  pattern: string | null;
  message: string;
  code: TCode;
  extensions: IExtension[];
}

export const rpcErrorResponseFactory = <TCode>(
  exception: DomainException<TCode>,
  service: symbol,
  pattern: string | null,
): IRpcErrorResponse<TCode> => ({
  timestamp: new Date().toISOString(),
  service,
  pattern,
  message: exception.message,
  code: exception.code,
  extensions: exception.extensions ?? [],
});

export const rpcServerErrorResponseFactory = (
  service: symbol,
  pattern: string | null,
  message: string,
): IRpcErrorResponse => ({
  timestamp: new Date().toISOString(),
  service,
  pattern,
  message,
  code: CommonDomainExceptionCode.InternalServerError,
  extensions: [],
});
