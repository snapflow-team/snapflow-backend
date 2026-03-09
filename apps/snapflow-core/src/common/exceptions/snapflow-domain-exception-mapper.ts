import { HttpStatus } from '@nestjs/common';
import {
  BaseDomainExceptionsCodeMapper,
  CommonDomainExceptionCodeType,
  IDomainCodeMapper,
} from '../../../../../libs/exceptions/core';
import {
  SnapFlowDomainExceptionCode,
  SnapFlowDomainExceptionCodeType,
} from './domain-exception-codes';

// todo: до настроить!!!
export class SnapFlowDomainExceptionCodeMapper
  extends BaseDomainExceptionsCodeMapper
  implements IDomainCodeMapper<SnapFlowDomainExceptionCodeType>
{
  mapToHttpStatus(code: SnapFlowDomainExceptionCodeType): HttpStatus {
    switch (code) {
      case SnapFlowDomainExceptionCode.EmailNotConfirmed:
        return HttpStatus.FORBIDDEN;
      case SnapFlowDomainExceptionCode.ConfirmationCodeExpired:
      case SnapFlowDomainExceptionCode.PasswordRecoveryCodeExpired:
        return HttpStatus.BAD_REQUEST;
      default:
        return super.mapToHttpStatus(code as CommonDomainExceptionCodeType);
    }
  }
}
