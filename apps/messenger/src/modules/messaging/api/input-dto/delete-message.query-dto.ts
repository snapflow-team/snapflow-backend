import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export type DeleteMessageScope = 'me' | 'everyone';

export class DeleteMessageQueryDto {
  @IsIn(['me', 'everyone'])
  @ApiProperty({
    enum: ['me', 'everyone'],
    description: 'Область удаления: только для себя или для всех участников',
    example: 'me',
  })
  scope: DeleteMessageScope;
}
