import { DomainExceptionCode } from './domain-exception-codes';
import { Extension } from './damain.exception';

export interface ErrorResponse {
  timestamp: string;
  path: string | null;
  method: string | null;
  message: string;
  code: DomainExceptionCode;
  extensions: Extension[];
}
