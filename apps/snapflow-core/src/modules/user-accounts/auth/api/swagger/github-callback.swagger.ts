import { ApiBadRequestResponse, ApiOperation, ApiResponse, ApiUnauthorizedResponse, } from '@nestjs/swagger';
import { applyDecorators } from '@nestjs/common';

export function GithubCallbackSwagger() {
  return applyDecorators(
    ApiOperation({
      summary: 'Обработка callback от GitHub OAuth',
      description:
        'Обрабатывает callback от GitHub, создает или связывает аккаунт, генерирует токены, устанавливает refreshToken в cookie и перенаправляет на базовый URL.',
    }),
    ApiResponse({
      status: 302,
      description: 'Успешный редирект на базовый URL после установки cookie с refreshToken',
    }),
    ApiBadRequestResponse({
      description: 'Если провайдер не предоставил email или другие обязательные данные',
    }),
    ApiUnauthorizedResponse({
      description: 'Если аутентификация не удалась или токены недействительны',
    }),
  );
}
