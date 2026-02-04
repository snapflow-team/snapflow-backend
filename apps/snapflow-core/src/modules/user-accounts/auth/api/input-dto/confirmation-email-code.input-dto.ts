import { IsUUID } from 'class-validator';

export class ConfirmationEmailCodeInputDto {
  @IsUUID('4', { message: 'Invalid confirmation code' })
  code: string;
}
