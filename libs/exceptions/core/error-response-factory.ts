import { DomainException } from './domain-exception';
import { IErrorResponse } from './error-response';
import { CommonDomainExceptionCode } from './domain-exception-codes';

export interface IErrorResponseFactory<TCode> {
  (
    exception: DomainException<TCode>,
    requestUrl: string,
    requestMethod: string,
  ): IErrorResponse<TCode>;
}

export interface IServerErrorResponseFactory<TCode> {
  (requestUrl: string | null, requestMethod: string | null, message: string): IErrorResponse<TCode>;
}

export const errorResponseFactory = <TCode>(
  exception: DomainException<TCode>,
  requestUrl: string,
  requestMethod: string,
): IErrorResponse<TCode> => ({
  timestamp: new Date().toISOString(),
  path: requestUrl,
  method: requestMethod,
  message: exception.message,
  code: exception.code,
  extensions: exception.extensions ?? [],
});

export const serverErrorResponseFactory = (
  requestUrl: string | null,
  requestMethod: string | null,
  message: string,
): IErrorResponse => ({
  timestamp: new Date().toISOString(),
  path: requestUrl,
  method: requestMethod,
  message,
  code: CommonDomainExceptionCode.InternalServerError,
  extensions: [],
});
