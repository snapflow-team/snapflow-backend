import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiNoContentResponse,
  ApiOperation,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { RegistrationEmailResendingInputDto } from '../input-dto/registration-email-resending.input-dto';
import { ErrorResponseDto } from '../../../../../../../../libs/common/exceptions/dto/error-response-body.dto';

export function ApiRegisterEmailResendingCommand() {
  return applyDecorators(
    ApiOperation({
      summary: 'Повторно отправить подтверждение регистрации, если пользователь существует',
    }),
    ApiBody({
      description: 'Данные для повторного подтверждения регистрации',
      type: RegistrationEmailResendingInputDto,
    }),
    ApiNoContentResponse({
      description:
        'Входные данные приняты. Электронное письмо с кодом подтверждения будет отправлено на указанный адрес электронной почты. Код подтверждения должен находиться внутри ссылки в качестве параметра запроса',
    }),
    ApiBadRequestResponse({
      description: 'Если в inputModel неверные значения',
      type: ErrorResponseDto,
    }),
    ApiTooManyRequestsResponse({
      description: 'Более 5 попыток с одного IP-адреса за 10 секунд',
    }),
  );
}
