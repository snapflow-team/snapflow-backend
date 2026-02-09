import { IsEmail, IsString, Matches } from 'class-validator';
import { Trim } from '../../../../../../../../libs/common/decorators/transform/trim.decorator';
import { emailConstraints, passwordConstraints } from './registration-user.input-dto';
import {
  IsStringWithTrim
} from '../../../../../../../../libs/common/decorators/validation/is-string-with-trim.decorator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginUserInputDto {
  @ApiProperty({
    description:
      'Email должен быть корректным адресом в формате local-part@domain.tld. Допустимы буквы, цифры, подчеркивание, точка и дефис в локальной части и домене.',
    pattern: emailConstraints.match.source,
    example: 'exemple@example.com',
  })
  @IsString()
  @IsEmail()
  @Matches(emailConstraints.match, {
    message:
      'Email must be a valid address in the format local-part@domain.tld (letters, digits, underscore, dot and hyphen allowed in local part and domain).',
  })
  @Trim()
  email: string;

  @ApiProperty({
    description:
      'Пароль должен быть от 6 до 20 символов, содержать хотя бы одну строчную букву, одну заглавную букву, одну цифру и только разрешённые спецсимволы: !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~.',
    minLength: passwordConstraints.minLength,
    maxLength: passwordConstraints.maxLength,
    pattern: passwordConstraints.match.source,
    example: 'Qwerty1!',
  })
  @Matches(passwordConstraints.match, {
    message:
      'Password must be 6–20 characters long and contain at least one lowercase letter, one uppercase letter, one digit, and only the following special characters: !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~.',
  })
  @IsStringWithTrim(passwordConstraints.minLength, passwordConstraints.maxLength)
  password: string;
}
