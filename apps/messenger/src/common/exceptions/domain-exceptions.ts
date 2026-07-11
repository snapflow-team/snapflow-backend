import { DomainException, IExtension } from '../../../../../libs/exceptions/core';
import { MessengerResultCode, MessengerResultCodeType } from '../notification/messenger-result-code';

export class BadRequestException extends DomainException<MessengerResultCodeType> {
  constructor(message: string = 'Bad Request', extensions?: IExtension[]) {
    super({
      code: MessengerResultCode.BadRequest,
      message,
      extensions,
    });
  }
}

export class UnauthorizedException extends DomainException<MessengerResultCodeType> {
  constructor(message: string = 'Unauthorized', extensions?: IExtension[]) {
    super({
      code: MessengerResultCode.Unauthorized,
      message,
      extensions,
    });
  }
}

export class ForbiddenException extends DomainException<MessengerResultCodeType> {
  constructor(message: string = 'Forbidden', extensions?: IExtension[]) {
    super({
      code: MessengerResultCode.Forbidden,
      message,
      extensions,
    });
  }
}
