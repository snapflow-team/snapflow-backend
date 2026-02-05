import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConfirmationEmailCodeInputDto {
  @IsUUID('4', { message: 'Invalid confirmation code' })
  @ApiProperty({
    example: 'f11cf4ee-2e4e-433b-8539-0634d79e8db',
    description: 'confirmation code',
    type: 'string',
  })
  code: string;
}
