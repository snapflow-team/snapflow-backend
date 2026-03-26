import { ApiProperty } from '@nestjs/swagger';
import type { PaymentsDomainExceptionCodeType } from './domain-exception-codes';
import { PaymentsDomainExceptionCode } from './domain-exception-codes';
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

export class ErrorResponseDto implements IErrorResponse<PaymentsDomainExceptionCodeType> {
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
    enum: Object.values(PaymentsDomainExceptionCode),
    example: PaymentsDomainExceptionCode.ValidationError,
  })
  code: PaymentsDomainExceptionCodeType;

  @ApiProperty({ type: [ExtensionsDto] })
  extensions: ExtensionsDto[];
}
