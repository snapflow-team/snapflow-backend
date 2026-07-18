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

export class NotFoundException extends DomainException<MessengerResultCodeType> {
  constructor(
    message: string = 'Not Found',
    code: MessengerResultCodeType = MessengerResultCode.NotFound,
    extensions?: IExtension[],
  ) {
    super({
      code,
      message,
      extensions,
    });
  }
}

export class InternalServerException extends DomainException<MessengerResultCodeType> {
  constructor(message: string = 'Internal server error', extensions?: IExtension[]) {
    super({
      code: MessengerResultCode.InternalServerError,
      message,
      extensions,
    });
  }
}
