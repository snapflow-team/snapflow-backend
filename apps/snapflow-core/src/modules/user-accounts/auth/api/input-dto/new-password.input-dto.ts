import { IsUUID, Matches } from 'class-validator';
import {
  IsStringWithTrim
} from '../../../../../../../../libs/common/decorators/validation/is-string-with-trim.decorator';
import { ApiProperty } from '@nestjs/swagger';
import { passwordConstraints } from './registration-user.input-dto';

export class NewPasswordInputDto {
  @Matches(passwordConstraints.match, {
    message:
      'Password must be 6–20 characters long and contain at least one lowercase letter, one uppercase letter, one digit, and only the following special characters: !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~.',
  })
  @IsStringWithTrim(passwordConstraints.minLength, passwordConstraints.maxLength)
  @ApiProperty({
    description:
      'Пароль должен быть от 6 до 20 символов, содержать хотя бы одну строчную букву, одну заглавную букву, одну цифру и только разрешённые спецсимволы: !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~.',
    minLength: passwordConstraints.minLength,
    maxLength: passwordConstraints.maxLength,
    pattern: passwordConstraints.match.source,
    example: 'Qwerty1!',
  })
  newPassword: string;

  @IsUUID('4', { message: 'Invalid recovery code' })
  @ApiProperty({
    example: 'f11cf4ee-2e4e-433b-8539-0634d79e8db',
    description: 'recovery code',
    type: 'string',
  })
  recoveryCode: string;
}
