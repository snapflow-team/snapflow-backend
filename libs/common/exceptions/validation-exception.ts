import { DomainExceptionCode } from './domain-exception-codes';
import { DomainException, Extension } from './damain.exception';

export class ValidationException extends DomainException {
  constructor(extensions: Extension[]) {
    super({
      code: DomainExceptionCode.ValidationError,
      message: 'Validation failed',
      extensions,
    });
  }
}
