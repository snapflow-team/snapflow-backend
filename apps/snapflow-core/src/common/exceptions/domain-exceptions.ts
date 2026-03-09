import { DomainException } from '../../../../../libs/exceptions/core';
import { SnapFlowDomainExceptionCode, SnapFlowDomainExceptionCodeType, } from './domain-exception-codes';

export class UnauthorisedException extends DomainException<SnapFlowDomainExceptionCodeType> {
  constructor(message: string = 'Unauthorised') {
    super({
      code: SnapFlowDomainExceptionCode.Unauthorized,
      message,
    });
  }
}
