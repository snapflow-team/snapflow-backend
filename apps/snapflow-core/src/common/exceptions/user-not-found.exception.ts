import { DomainException } from '../../../../../libs/common/exceptions/damain.exception';
import { HttpStatus } from '@nestjs/common';
import { ErrorCodes } from '../../../../../libs/common/exceptions/error-codes.enum';

export class UserNotFoundException extends DomainException {
  constructor(userId?: string) {
    super(
      ErrorCodes.USER_NOT_FOUND,
      userId ? `User with ID ${userId} not found` : 'User not found',
      HttpStatus.NOT_FOUND,
    );
  }
}