import { IsEnum } from 'class-validator';
import { BaseQueryParams } from '../../../../common/dto/base.query-params.input-dto';

export enum PaymentsSortBy {
  CreatedAt = 'createdAt',
  Provider = 'provider',
  Status = 'status',
  Plan = 'planId',
}

export class GetPaymentsQueryParams extends BaseQueryParams<PaymentsSortBy> {
  @IsEnum(PaymentsSortBy)
  sortBy: PaymentsSortBy = PaymentsSortBy.CreatedAt;
}
