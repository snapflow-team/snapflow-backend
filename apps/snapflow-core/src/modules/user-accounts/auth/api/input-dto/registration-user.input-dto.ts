import { IsEmail, IsString, Matches } from 'class-validator';
import {
  IsStringWithTrim
} from '../../../../../../../../libs/common/decorators/validation/is-string-with-trim.decorator';
import { Trim } from '../../../../../../../../libs/common/decorators/transform/trim.decorator';
import { ApiProperty } from '@nestjs/swagger';

export const usernameConstraints = {
  minLength: 6,
  maxLength: 30,
  match: /^[a-zA-Z0-9_-]*$/,
};

export const emailConstraints = {
  match: /^[A-Za-z0-9_.-]+@[A-Za-z0-9-]+(\.[A-Za-z]{2,4})+$/,
};

export const passwordConstraints = {
  minLength: 6,
  maxLength: 20,
  match: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]{6,20}$/,
};

export class RegistrationUserInputDto {
  @Matches(usernameConstraints.match, {
    message:
      'Username must be 6–30 characters long and contain only letters (a–z, A–Z), digits (0–9), underscore (_) and hyphen (-).',
  })
  @IsStringWithTrim(usernameConstraints.minLength, usernameConstraints.maxLength)
  @ApiProperty({
    description:
      'Имя пользователя (username) должно быть от 6 до 30 символов и содержать только буквы латинского алфавита (a–z, A–Z), цифры (0–9), подчеркивание (_) и дефис (-).',
    minLength: usernameConstraints.minLength,
    maxLength: usernameConstraints.maxLength,
    pattern: usernameConstraints.match.source,
    example: 'username_01',
  })
  username: string;

  @IsString()
  @IsEmail()
  @Matches(emailConstraints.match, {
    message:
      'Email must be a valid address in the format local-part@domain.tld (letters, digits, underscore, dot and hyphen allowed in local part and domain).',
  })
  @Trim()
  @ApiProperty({
    description:
      'Email должен быть корректным адресом в формате local-part@domain.tld. Допустимы буквы, цифры, подчеркивание, точка и дефис в локальной части и домене.',
    pattern: emailConstraints.match.source,
    example: 'username_01@example.com',
  })
  email: string;

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
  password: string;
}
