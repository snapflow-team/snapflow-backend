import { HttpStatus, Injectable } from '@nestjs/common';
import { BaseDomainExceptionsCodeMapper } from '../../../../../libs/exceptions/core';
import { PaymentsDomainExceptionCodeType } from './domain-exception-codes';

@Injectable()
export class PaymentsDomainExceptionCodeMapper extends BaseDomainExceptionsCodeMapper {
  mapToHttpStatus(code: PaymentsDomainExceptionCodeType): HttpStatus {
    switch (code) {
      default:
        return super.mapToHttpStatus(code);
    }
  }
}
