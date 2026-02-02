import { ValidationErrorDetail } from './interfaces/validation-error-detail.interface';
import { DomainException } from './damain.exception';
import { ErrorCodes } from './error-codes.enum';
import { HttpStatus } from '@nestjs/common';

export class ValidationException extends DomainException {
  constructor(errors: ValidationErrorDetail[], message: string = 'Data validation error') {
    super(ErrorCodes.VALIDATION_ERROR, message, HttpStatus.BAD_REQUEST, errors);
  }
}
