import { ExecutionContext, Injectable, ValidationError } from '@nestjs/common';
import { Request } from 'express';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AuthGuard } from '@nestjs/passport';
import { LoginUserInputDto } from '../../../api/input-dto/login-user.input-dto';
import {
  formatValidationErrors
} from '../../../../../../../../../libs/common/exceptions/utils/format-validation-errors';
import { Extension } from '../../../../../../../../../libs/common/exceptions/damain.exception';
import { ValidationException } from '../../../../../../../../../libs/common/exceptions/validation-exception';

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
      const extensions: Extension[] = formatValidationErrors(errors);

      throw new ValidationException(extensions);
    }

    return super.canActivate(context) as boolean;
  }
}
