import { DomainException } from '../../../../../libs/exceptions/core';
import { SnapFlowDomainExceptionCode, SnapFlowDomainExceptionCodeType, } from './domain-exception-codes';

export class BadRequestException extends DomainException<SnapFlowDomainExceptionCodeType> {
  constructor(message: string = 'Bad Request') {
    super({
      code: SnapFlowDomainExceptionCode.BadRequest,
      message,
    });
  }
}

export class UnauthorizedException extends DomainException<SnapFlowDomainExceptionCodeType> {
  constructor(message: string = 'Unauthorized') {
    super({
      code: SnapFlowDomainExceptionCode.Unauthorized,
      message,
    });
  }
}

export class NotFoundException extends DomainException<SnapFlowDomainExceptionCodeType> {
  constructor(message: string = 'Not Found') {
    super({
      code: SnapFlowDomainExceptionCode.NotFound,
      message,
    });
  }
}
