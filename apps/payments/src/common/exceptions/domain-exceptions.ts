import { DomainException, IExtension } from '../../../../../libs/exceptions/core';
import { NotificationResultCode, NotificationResultCodeType, } from '../notification/notification-result-code';

export class BadRequestException extends DomainException<NotificationResultCodeType> {
  constructor(message: string = 'Bad Request', extensions?: IExtension[]) {
    super({
      code: NotificationResultCode.BadRequest,
      message,
      extensions,
    });
  }
}

export class UnauthorizedException extends DomainException<NotificationResultCodeType> {
  constructor(message: string = 'Unauthorized', extensions?: IExtension[]) {
    super({
      code: NotificationResultCode.Unauthorized,
      message,
      extensions,
    });
  }
}

export class InternalServerErrorException extends DomainException<NotificationResultCodeType> {
  constructor(message: string = 'Some error occurred', extensions?: IExtension[]) {
    super({
      code: NotificationResultCode.InternalServerError,
      message,
      extensions,
    });
  }
}
