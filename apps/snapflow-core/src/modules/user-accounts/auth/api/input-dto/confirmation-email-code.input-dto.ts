import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConfirmationEmailCodeInputDto {
  @IsUUID('4', { message: 'Invalid confirmation code' })
  @ApiProperty({ example: 'string', description: 'confirmation code', type: 'string' })
  code: string;
}
