import { IsEnum } from 'class-validator';
import { BaseQueryParams } from '../../../../common/dto/base.query-params.input-dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum PaymentsSortBy {
  CreatedAt = 'createdAt',
  Provider = 'provider',
  Status = 'status',
  Plan = 'planId',
}

export class GetPaymentsQueryParams extends BaseQueryParams<PaymentsSortBy> {
  @ApiPropertyOptional({
    description: 'Sort by field',
    example: PaymentsSortBy.CreatedAt,
    default: PaymentsSortBy.CreatedAt,
    enum: PaymentsSortBy,
  })
  @IsEnum(PaymentsSortBy)
  sortBy: PaymentsSortBy = PaymentsSortBy.CreatedAt;
}
