import { DomainException } from '../../../../../libs/exceptions/core/domain-exception';
import { SNAPFLOW_CODES, SnapFlowDomainExceptionCode } from './domain-exception-codes';

export class UnauthorisedException extends DomainException<SnapFlowDomainExceptionCode> {
  constructor(message: string = 'Unauthorised') {
    super({
      code: SNAPFLOW_CODES.Unauthorized,
      message,
    });
  }
}
