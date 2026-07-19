import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum DeleteMessageScope {
  Me = 'me',
  Everyone = 'everyone',
}

export class DeleteMessageQueryDto {
  @IsEnum(DeleteMessageScope)
  @ApiProperty({
    enum: DeleteMessageScope,
    description: 'Область удаления: только для себя или для всех участников',
    example: DeleteMessageScope.Me,
  })
  scope: DeleteMessageScope;
}
