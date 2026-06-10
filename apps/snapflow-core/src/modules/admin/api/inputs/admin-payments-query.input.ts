import { Field, InputType, Int } from '@nestjs/graphql';
import { IsOptional, Min } from 'class-validator';
import {
  ADMIN_DEFAULT_PAGE,
  ADMIN_DEFAULT_PAGE_SIZE,
  ADMIN_DEFAULT_PAYMENTS_SORT_BY,
  ADMIN_DEFAULT_SORT_DIRECTION,
} from '../../constants/admin-query.defaults';
import { AdminSortDirection } from '../../domain/enums/admin-sort-direction.enum';
import { AdminPaymentsSortField } from '../../domain/enums/admin-payments-sort-field.enum';

@InputType()
export class AdminPaymentsQueryInput {
  @Field(() => Int, { defaultValue: ADMIN_DEFAULT_PAGE })
  @IsOptional()
  @Min(1)
  page?: number;

  @Field(() => Int, { defaultValue: ADMIN_DEFAULT_PAGE_SIZE })
  @IsOptional()
  @Min(1)
  pageSize?: number;

  @Field(() => AdminPaymentsSortField, {
    nullable: true,
    defaultValue: ADMIN_DEFAULT_PAYMENTS_SORT_BY,
  })
  sortBy?: AdminPaymentsSortField;

  @Field(() => AdminSortDirection, {
    nullable: true,
    defaultValue: ADMIN_DEFAULT_SORT_DIRECTION,
  })
  sortDirection?: AdminSortDirection;
}
