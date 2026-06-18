export enum InternalPaymentsSortField {
  Date = 'date',
  Amount = 'amount',
  Provider = 'provider',
}

export enum InternalPaymentsSortDirection {
  Ascending = 'asc',
  Descending = 'desc',
}

export const internalPaymentsQueryDefaults = {
  page: 1,
  pageSize: 6,
  sortBy: InternalPaymentsSortField.Date,
  sortDirection: InternalPaymentsSortDirection.Descending,
} as const;

export interface GetInternalPaymentsQueryParams {
  page: number;
  pageSize: number;
  sortBy: InternalPaymentsSortField;
  sortDirection: InternalPaymentsSortDirection;
  userIds?: number[];
}

export interface InternalPaymentItem {
  userId: string;
  subscriptionId: string;
  dateOfPayment: string;
  endDateOfSubscription: string | null;
  price: number;
  subscriptionType: string;
  provider: string;
}

export interface InternalPaymentsPaginatedResponse {
  page: number;
  pageSize: number;
  totalCount: number;
  pagesCount: number;
  items: InternalPaymentItem[];
}
