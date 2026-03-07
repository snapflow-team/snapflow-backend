import { DomainException } from './domain-exception';
import { IErrorResponse } from './error-response';

export interface IErrorResponseFactory<TCode> {
  (
    exception: DomainException<TCode>,
    requestUrl: string,
    requestMethod: string,
  ): IErrorResponse<TCode>;
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
