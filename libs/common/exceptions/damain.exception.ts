import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCodes } from './error-codes.enum';

export class DomainException extends HttpException {
  constructor(
    public readonly code: ErrorCodes,
    public readonly message: string,
    status: HttpStatus,
    public readonly errors: unknown[] = [],
  ) {
    super({ code, message, errors }, status);
  }
}

// if (!user) {
//   throw new UserNotFoundException(userId); // Фильтр вернет 404 и code: "USER_NOT_FOUND"
// }
