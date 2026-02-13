import { IsEmail, IsString, Matches } from 'class-validator';
import { Trim } from '../../../../../../../../libs/common/decorators/transform/trim.decorator';
import { ApiProperty } from '@nestjs/swagger';
import { emailConstraints } from './registration-user.input-dto';

export class PasswordRecoveryInputDto {
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
    example: 'example@example.com',
  })
  email: string;

  @ApiProperty({
    description:
      'Recaptcha token должен быть строкой, полученной от Google reCAPTCHA после успешного прохождения проверки пользователем.',
    example: '6LfsdsdSSEsAAAAALfsdfDmlRycmKgdsfgAlcxKEp2w1Vm',
    required: true,
    nullable: false,
  })
  @IsString({ message: 'Recaptcha token must be a string' })
  recaptchaToken: string;
}
