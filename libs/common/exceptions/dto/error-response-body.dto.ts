import { DomainExceptionCode } from '../types/domain-exception-codes';
import { DomainException, Extension } from '../damain.exception';
import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({
    example: '2026-02-09T12:34:56.789Z',
  })
  timestamp: string;

  @ApiProperty({
    example: '/auth/login',
    nullable: true,
  })
  path: string | null;

  @ApiProperty({
    example: 'POST',
    nullable: true,
  })
  method: string | null;

  @ApiProperty({
    example: 'Email already exists',
  })
  message: string;

  @ApiProperty({
    enum: DomainExceptionCode,
    example: DomainExceptionCode.ValidationError,
  })
  code: DomainExceptionCode;

  @ApiProperty({
    type: () => Extension,
    isArray: true,
    example: [{ field: 'email', message: 'Invalid email format' }],
  })
  extensions: Extension[];

  private constructor(props: ErrorResponseDto) {
    Object.assign(this, props);
  }

  static fromDomainException(
    exception: DomainException,
    requestUrl: string,
    requestMethod: string,
  ): ErrorResponseDto {
    return new ErrorResponseDto({
      timestamp: new Date().toISOString(),
      path: requestUrl,
      method: requestMethod,
      message: exception.message,
      code: exception.code,
      extensions: exception.extensions ?? [],
    });
  }

  static fromInternalError(
    requestUrl: string | null,
    requestMethod: string | null,
    message: string,
  ): ErrorResponseDto {
    return new ErrorResponseDto({
      timestamp: new Date().toISOString(),
      path: requestUrl,
      method: requestMethod,
      message,
      code: DomainExceptionCode.InternalServerError,
      extensions: [],
    });
  }
}
