import { ApiProperty } from '@nestjs/swagger';
import type { SnapFlowDomainExceptionCodeType } from './domain-exception-codes';
import { SnapFlowDomainExceptionCode } from './domain-exception-codes';
import { IExtension } from '../../../../../libs/exceptions/core/domain-exception';
import { IErrorResponse } from '../../../../../libs/exceptions/core/error-response';

export class ExtensionsDto implements IExtension {
  @ApiProperty({
    example: 'email',
  })
  field: string;

  @ApiProperty({
    example: 'Invalid email format',
  })
  message: string;
}

export class ErrorResponseDto implements IErrorResponse<SnapFlowDomainExceptionCodeType> {
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
    enum: Object.values(SnapFlowDomainExceptionCode),
    example: SnapFlowDomainExceptionCode.ValidationError,
  })
  code: SnapFlowDomainExceptionCodeType;

  @ApiProperty({ isArray: true })
  extensions: ExtensionsDto[];

  private constructor(props: ErrorResponseDto) {
    Object.assign(this, props);
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
      code: SnapFlowDomainExceptionCode.InternalServerError,
      extensions: [],
    });
  }
}
