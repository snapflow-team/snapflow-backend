import { Field, InputType, Int } from '@nestjs/graphql';
import { IsEnum, IsOptional, IsString, Min } from 'class-validator';
import { adminPaymentsQueryDefaults } from '../../constants/admin-query.defaults';
import { AdminSortDirection } from '../../domain/enums/admin-sort-direction.enum';
import { AdminPaymentsSortField } from '../../domain/enums/admin-payments-sort-field.enum';

@InputType()
export class AdminPaymentsQueryInput {
  @Field(() => Int, { defaultValue: adminPaymentsQueryDefaults.page })
  @IsOptional()
  @Min(1)
  page?: number;

  @Field(() => Int, { defaultValue: adminPaymentsQueryDefaults.pageSize })
  @IsOptional()
  @Min(1)
  pageSize?: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  search?: string;

  @Field(() => AdminPaymentsSortField, {
    nullable: true,
    defaultValue: adminPaymentsQueryDefaults.sortBy,
  })
  @IsOptional()
  @IsEnum(AdminPaymentsSortField)
  sortBy?: AdminPaymentsSortField;

  @Field(() => AdminSortDirection, {
    nullable: true,
    defaultValue: adminPaymentsQueryDefaults.sortDirection,
  })
  @IsOptional()
  @IsEnum(AdminSortDirection)
  sortDirection?: AdminSortDirection;
}
