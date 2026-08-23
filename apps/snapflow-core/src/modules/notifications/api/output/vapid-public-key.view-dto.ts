import { ApiProperty } from '@nestjs/swagger';

export class VapidPublicKeyViewDto {
  @ApiProperty({
    description: 'Публичный VAPID-ключ для регистрации push-подписки в браузере',
    example:
      'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZ-ZIg0n2w0k3U7gY1N8ki95Im1sE6rVWbZEY',
  })
  publicKey: string;
}
