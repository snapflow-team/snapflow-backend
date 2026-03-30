import { HttpStatus, Injectable } from '@nestjs/common';
import { BaseDomainExceptionsCodeMapper } from '../../../../../libs/exceptions/core';
import { NotificationResultCode, NotificationResultCodeType } from './notification-result-code';

@Injectable()
export class NotificationResultCodeMapper extends BaseDomainExceptionsCodeMapper {
  mapToHttpStatus(code: NotificationResultCodeType): HttpStatus {
    switch (code) {
      case NotificationResultCode.Success:
        return HttpStatus.OK;
      default:
        return super.mapToHttpStatus(code);
    }
  }
}
