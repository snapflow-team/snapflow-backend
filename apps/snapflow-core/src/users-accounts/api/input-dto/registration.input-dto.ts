import { IsEmail, IsString, Matches } from 'class-validator';
import { IsStringWithTrim } from '../../../../../../libs/common/decorators/validation/is-string-with-trim.decorator';
import { Trim } from '../../../../../../libs/common/decorators/transform/trim.decorator';

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

export class RegistrationInputDto {
  @Matches(usernameConstraints.match, {
    message:
      'Username must be 6–30 characters long and contain only letters (a–z, A–Z), digits (0–9), underscore (_) and hyphen (-).',
  })
  @IsStringWithTrim(usernameConstraints.minLength, usernameConstraints.maxLength)
  username: string;

  @IsString()
  @IsEmail()
  @Matches(emailConstraints.match, {
    message:
      'Email must be a valid address in the format local-part@domain.tld (letters, digits, underscore, dot and hyphen allowed in local part and domain).',
  })
  @Trim()
  email: string;

  @Matches(passwordConstraints.match, {
    message:
      'Password must be 6–20 characters long and contain at least one lowercase letter, one uppercase letter, one digit, and only the following special characters: !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~.',
  })
  @IsStringWithTrim(passwordConstraints.minLength, passwordConstraints.maxLength)
  password: string;
}
