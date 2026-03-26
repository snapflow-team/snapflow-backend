import { DomainException } from '../../../../../libs/exceptions/core';
import { PaymentsDomainExceptionCode, PaymentsDomainExceptionCodeType, } from './domain-exception-codes';

export class BadRequestException extends DomainException<PaymentsDomainExceptionCodeType> {
  constructor(message: string = 'Bad Request') {
    super({
      code: PaymentsDomainExceptionCode.BadRequest,
      message,
    });
  }
}

export class UnauthorizedException extends DomainException<PaymentsDomainExceptionCodeType> {
  constructor(message: string = 'Unauthorized') {
    super({
      code: PaymentsDomainExceptionCode.Unauthorized,
      message,
    });
  }
}
