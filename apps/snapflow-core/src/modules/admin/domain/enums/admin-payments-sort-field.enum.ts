import { registerEnumType } from '@nestjs/graphql';

export enum AdminPaymentsSortField {
  CreatedAt = 'createdAt',
  Provider = 'provider',
  Status = 'status',
  Plan = 'planId',
}

registerEnumType(AdminPaymentsSortField, {
  name: 'AdminPaymentsSortField',
});
