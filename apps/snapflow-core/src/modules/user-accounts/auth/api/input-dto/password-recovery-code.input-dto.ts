import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PasswordRecoveryCodeInputDto {
  @IsUUID('4', { message: 'Invalid recovery code' })
  @ApiProperty({
    example: 'f11cf4ee-2e4e-433b-8539-0634d79e8db',
    description: 'recovery code',
    type: 'string',
  })
  recoveryCode: string;
}
