import { IsDateString, IsOptional, Matches, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsStringWithTrim
} from '../../../../../../../../../libs/common/decorators/validation/is-string-with-trim.decorator';
import { usernameConstraints } from '../../../../auth/api/input-dto/registration-user.input-dto';

export const firstNameConstraints = {
  minLength: 1,
  maxLength: 50,
  match: /^[А-ЯЁа-яёA-Za-z]+(?:\s*[А-ЯЁа-яёA-Za-z]+)*$/u,
};

export const lastNameConstraints = {
  minLength: 1,
  maxLength: 50,
  match: /^[А-ЯЁа-яёA-Za-z]+(?:\s*[А-ЯЁа-яёA-Za-z]+)*$/u,
};

export class UpdateProfileInputDto {
  @Matches(usernameConstraints.match, {
    message: `Username must be ${usernameConstraints.minLength}–${usernameConstraints.maxLength} characters long and contain only letters (a–z, A–Z), digits (0–9), underscore (_) and hyphen (-).`,
  })
  @IsStringWithTrim(usernameConstraints.minLength, usernameConstraints.maxLength)
  @ApiProperty({
    minLength: usernameConstraints.minLength,
    maxLength: usernameConstraints.maxLength,
    pattern: usernameConstraints.match.source,
    example: 'username_01',
  })
  username: string;

  @Matches(firstNameConstraints.match, {
    message: `First name can contain only Latin and Russian letters`,
  })
  @IsStringWithTrim(firstNameConstraints.minLength, firstNameConstraints.maxLength)
  @ApiProperty({
    minLength: firstNameConstraints.minLength,
    maxLength: firstNameConstraints.maxLength,
    pattern: firstNameConstraints.match.source,
    example: 'Alex',
  })
  firstName: string;

  @Matches(lastNameConstraints.match, {
    message: `Last name can contain only Latin and Russian letters`,
  })
  @IsStringWithTrim(lastNameConstraints.minLength, lastNameConstraints.maxLength)
  @ApiProperty({
    minLength: lastNameConstraints.minLength,
    maxLength: lastNameConstraints.maxLength,
    pattern: lastNameConstraints.match.source,
    example: 'Smith',
  })
  lastName: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({
    example: '2000-01-01',
    description: 'ISO date string',
  })
  dateOfBirth?: string;

  @IsOptional()
  @IsStringWithTrim(1, 50)
  @ApiPropertyOptional({ example: 'Russia' })
  country?: string;

  @IsOptional()
  @IsStringWithTrim(1, 50)
  @ApiPropertyOptional({ example: 'Moscow' })
  city?: string;

  @IsOptional()
  @IsStringWithTrim(0, 200)
  @MaxLength(200)
  @ApiPropertyOptional({
    maxLength: 200,
    example: 'Backend developer',
  })
  aboutMe?: string;
}
