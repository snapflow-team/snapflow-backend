import { HttpStatus, Injectable } from '@nestjs/common';
import { BaseDomainExceptionsCodeMapper } from '../../../../../libs/exceptions/core';
import { MessengerResultCode, MessengerResultCodeType } from './messenger-result-code';

@Injectable()
export class MessengerResultCodeMapper extends BaseDomainExceptionsCodeMapper {
  mapToHttpStatus(code: MessengerResultCodeType): HttpStatus {
    switch (code) {
      case MessengerResultCode.Success:
        return HttpStatus.OK;
      default:
        return super.mapToHttpStatus(code);
    }
  }
}
