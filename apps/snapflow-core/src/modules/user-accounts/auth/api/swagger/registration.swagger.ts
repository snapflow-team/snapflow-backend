import { applyDecorators } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBody, ApiNoContentResponse, ApiOperation, } from '@nestjs/swagger';
import { RegistrationUserInputDto } from '../input-dto/registration-user.input-dto';
import { ErrorResponseDto } from '../../../../../../../../libs/common/exceptions/dto/error-response-body.dto';

export function ApiRegistration() {
  return applyDecorators(
    ApiOperation({
      summary: 'Регистрация пользователя',
      description:
        'Создаёт нового пользователя. Генерируется код подтверждения и отправляется на email.',
    }),
    ApiBody({
      description: 'Данные для регистрации пользователя',
      type: RegistrationUserInputDto,
    }),
    ApiNoContentResponse({
      description:
        'Пользователь успешно зарегистрирован. Письмо с кодом подтверждения будет отправлено на переданный адрес электронной почты',
    }),
    ApiBadRequestResponse({
      description: 'Если в inputModel неверные значения',
      type: ErrorResponseDto,
    }),
  );
}
