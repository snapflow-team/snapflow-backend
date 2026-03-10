import { ApiProperty } from '@nestjs/swagger';
import type { SnapFlowDomainExceptionCodeType } from './domain-exception-codes';
import { SnapFlowDomainExceptionCode } from './domain-exception-codes';
import { IErrorResponse, IExtension } from '../../../../../libs/exceptions/core';

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
}
