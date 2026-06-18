import { Transform, Type } from 'class-transformer';
import { IsArray, IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import {
  GetInternalPaymentsQueryParams,
  internalPaymentsQueryDefaults,
  InternalPaymentsSortDirection,
  InternalPaymentsSortField,
} from '../../../../../../../libs/contracts/payments';

export class GetInternalPaymentsQueryParamsInputDto implements GetInternalPaymentsQueryParams {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page: number = internalPaymentsQueryDefaults.page;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  pageSize: number = internalPaymentsQueryDefaults.pageSize;

  @IsEnum(InternalPaymentsSortField)
  sortBy: InternalPaymentsSortField = internalPaymentsQueryDefaults.sortBy;

  @IsEnum(InternalPaymentsSortDirection)
  sortDirection: InternalPaymentsSortDirection = internalPaymentsQueryDefaults.sortDirection;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const rawValues = Array.isArray(value) ? value : String(value).split(',');
    const userIds = rawValues
      .map((item) => Number(String(item).trim()))
      .filter((item) => Number.isInteger(item) && item > 0);

    return userIds.length > 0 ? userIds : undefined;
  })
  @IsArray()
  @IsNumber({}, { each: true })
  userIds?: number[];

  calculateSkip(): number {
    return (this.page - 1) * this.pageSize;
  }
}
