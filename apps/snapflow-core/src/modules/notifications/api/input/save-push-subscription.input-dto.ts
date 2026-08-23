import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';

export class PushSubscriptionKeysInputDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'P-256 ECDH public key подписки (base64url)',
    example:
      'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZ-ZIg0n2w0k3U7gY1N8ki95Im1sE6rVWbZEY',
  })
  p256dh: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Auth secret подписки (base64url)',
    example: 'tBHItJI5svbpez7KI4CCXg',
  })
  auth: string;
}

export class SavePushSubscriptionInputDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'URL endpoint push-сервиса браузера',
    example: 'https://fcm.googleapis.com/fcm/send/example-endpoint',
  })
  endpoint: string;

  @ValidateNested()
  @Type(() => PushSubscriptionKeysInputDto)
  @ApiProperty({ type: PushSubscriptionKeysInputDto })
  keys: PushSubscriptionKeysInputDto;
}
