import { Notification } from './notification';
import { NotificationResultCode } from './notification-result-code';
import {
  BadRequestException,
  InternalServerErrorException,
  UnauthorizedException,
} from '../exceptions/domain-exceptions';

export class NotificationExceptionMapper {
  static throw(notification: Notification<any>): never {
    const { code, message, extensions } = notification;

    switch (code) {
      case NotificationResultCode.BadRequest:
      case NotificationResultCode.ValidationError:
        throw new BadRequestException(message, extensions);

      case NotificationResultCode.Unauthorized:
        throw new UnauthorizedException(message, extensions);

      case NotificationResultCode.InternalServerError:
        throw new InternalServerErrorException(message, extensions);
      default:
        throw new BadRequestException(message, extensions);
    }
  }
}
