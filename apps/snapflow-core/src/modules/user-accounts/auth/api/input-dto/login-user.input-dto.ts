import { IsEmail, IsString, Matches } from 'class-validator';
import { Trim } from '../../../../../../../../libs/common/decorators/transform/trim.decorator';
import { emailConstraints, passwordConstraints } from './registration-user.input-dto';
import { IsStringWithTrim } from '../../../../../../../../libs/common/decorators/validation/is-string-with-trim.decorator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginUserInputDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User login or email',
  })
  @IsString()
  @IsEmail()
  @Matches(emailConstraints.match, {
    message:
      'Email must be a valid address in the format local-part@domain.tld (letters, digits, underscore, dot and hyphen allowed in local part and domain).',
  })
  @Trim()
  email: string;

  @ApiProperty({ example: 'password', description: 'User password' })
  @Matches(passwordConstraints.match, {
    message:
      'Password must be 6–20 characters long and contain at least one lowercase letter, one uppercase letter, one digit, and only the following special characters: !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~.',
  })
  @IsStringWithTrim(passwordConstraints.minLength, passwordConstraints.maxLength)
  password: string;
}
