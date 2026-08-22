import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class DeletePushSubscriptionInputDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'URL endpoint push-подписки для удаления',
    example: 'https://fcm.googleapis.com/fcm/send/example-endpoint',
  })
  endpoint: string;
}
