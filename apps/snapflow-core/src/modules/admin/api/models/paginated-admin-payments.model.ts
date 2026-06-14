import { Field, ObjectType } from '@nestjs/graphql';
import { AdminPaymentModel } from './admin-payment.model';
import { PageInfoModel } from './page-info.model';

@ObjectType()
export class PaginatedAdminPaymentsModel {
  @Field(() => [AdminPaymentModel])
  items: AdminPaymentModel[];

  @Field(() => PageInfoModel)
  pageInfo: PageInfoModel;
}
