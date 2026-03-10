import { CommonDomainExceptionCode, CommonDomainExceptionCodeType, DomainException, IExtension, } from '../core';

export interface IRpcErrorResponse<TCode = CommonDomainExceptionCodeType> {
  timestamp: string;
  service: string; // ← RPC: имя сервиса
  pattern: string | null; // ← RPC: паттерн сообщения
  message: string;
  code: TCode;
  extensions: IExtension[];
}

export const rpcErrorResponseFactory = <TCode>(
  exception: DomainException<TCode>,
  service: string,
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
  service: string,
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
