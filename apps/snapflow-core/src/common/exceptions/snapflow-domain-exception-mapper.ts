import { HttpStatus } from '@nestjs/common';
import { BaseDomainExceptionsCodeMapper } from '../../../../../libs/exceptions/core';
import { SnapFlowDomainExceptionCodeType } from './domain-exception-codes';

export class SnapFlowDomainExceptionCodeMapper extends BaseDomainExceptionsCodeMapper {
  mapToHttpStatus(code: SnapFlowDomainExceptionCodeType): HttpStatus {
    switch (code) {
      default:
        return super.mapToHttpStatus(code);
    }
  }
}
