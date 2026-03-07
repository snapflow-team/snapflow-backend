import { ExecutionContext, Injectable, ValidationError } from '@nestjs/common';
import { Request } from 'express';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AuthGuard } from '@nestjs/passport';
import { LoginUserInputDto } from '../../../api/input-dto/login-user.input-dto';
import { DomainException } from '../../../../../../../../../libs/exceptions/http/damain.exception';
import { DomainExceptionCode } from '../../../../../../../../../libs/exceptions/core/domain-exception-codes';

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
      throw new DomainException({
        code: DomainExceptionCode.Unauthorized,
        message: 'Invalid email or password',
      });
    }

    return super.canActivate(context) as boolean;
  }
}
