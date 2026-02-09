import { ApiProperty } from '@nestjs/swagger';

export class LoginViewDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT access token для авторизации пользователя',
  })
  accessToken: string;
}
