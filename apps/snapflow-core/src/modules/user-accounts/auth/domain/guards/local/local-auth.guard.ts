import { ExecutionContext, Injectable, ValidationError } from '@nestjs/common';
import { Request } from 'express';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AuthGuard } from '@nestjs/passport';
import { LoginUserInputDto } from '../../../api/input-dto/login-user.input-dto';
import { formatValidationErrors } from '../../../../../../../../../libs/common/exceptions/utils/error-formatter.util';
import {
  ValidationErrorDetail
} from '../../../../../../../../../libs/common/exceptions/interfaces/validation-error-detail.interface';
import { ValidationException } from '../../../../../../../../../libs/common/exceptions/validation.exception';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const dtoObject: LoginUserInputDto = plainToInstance(LoginUserInputDto, request.body);

    const errors: ValidationError[] = validateSync(dtoObject, {
      whitelist: true,
      forbidNonWhitelisted: true,
      stopAtFirstError: true,
    });

    if (errors.length > 0) {
      const errorsForResponse: ValidationErrorDetail[] = formatValidationErrors(errors);

      throw new ValidationException(errorsForResponse);
    }

    return super.canActivate(context) as boolean;
  }
}
