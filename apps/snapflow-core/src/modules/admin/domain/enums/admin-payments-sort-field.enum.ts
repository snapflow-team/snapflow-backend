import { registerEnumType } from '@nestjs/graphql';

export enum AdminPaymentsSortField {
  Username = 'username',
  Date = 'date',
  Amount = 'amount',
  Provider = 'provider',
}

registerEnumType(AdminPaymentsSortField, {
  name: 'AdminPaymentsSortField',
});
