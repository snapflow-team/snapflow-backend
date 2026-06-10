import { Field, InputType, Int } from '@nestjs/graphql';
import { IsOptional, Min } from 'class-validator';
import { AdminSortDirection } from '../../domain/enums/admin-sort-direction.enum';
import { AdminPaymentsSortField } from '../../domain/enums/admin-payments-sort-field.enum';

@InputType()
export class AdminPaymentsQueryInput {
  @Field(() => Int, { defaultValue: 1 })
  @IsOptional()
  @Min(1)
  page?: number;

  @Field(() => Int, { defaultValue: 8 })
  @IsOptional()
  @Min(1)
  pageSize?: number;

  @Field(() => AdminPaymentsSortField, {
    nullable: true,
    defaultValue: AdminPaymentsSortField.CreatedAt,
  })
  sortBy?: AdminPaymentsSortField;

  @Field(() => AdminSortDirection, {
    nullable: true,
    defaultValue: AdminSortDirection.Descending,
  })
  sortDirection?: AdminSortDirection;
}
