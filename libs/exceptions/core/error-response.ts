import { CommonDomainExceptionCodeType } from './domain-exception-codes';
import { IExtension } from './domain-exception';

export interface ErrorResponse<TCode = CommonDomainExceptionCodeType> {
  timestamp: string;
  path: string | null;
  method: string | null;
  message: string;
  code: TCode;
  extensions: IExtension[];
}
