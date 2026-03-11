import { DomainException, IExtension } from './domain-exception';
import { CommonDomainExceptionCode } from './domain-exception-codes';

export class ValidationException extends DomainException {
  constructor(extensions: IExtension[]) {
    super({
      code: CommonDomainExceptionCode.ValidationError,
      message: 'Validation failed',
      extensions,
    });
  }
}
