import {
  GetInternalPaymentsQueryParams,
  InternalPaymentsSortDirection,
  InternalPaymentsSortField,
} from '../../../../../../../libs/contracts/payments/constants/internal-payments-api.contract';
import { GetAdminPaymentsQueryParams } from '../../application/dto/get-admin-payments-query.params';
import { AdminPaymentsSortField } from '../../domain/enums/admin-payments-sort-field.enum';
import { AdminSortDirection } from '../../domain/enums/admin-sort-direction.enum';

const adminToInternalSortFieldMap: Record<
  Exclude<AdminPaymentsSortField, AdminPaymentsSortField.Username>,
  InternalPaymentsSortField
> = {
  [AdminPaymentsSortField.Date]: InternalPaymentsSortField.Date,
  [AdminPaymentsSortField.Amount]: InternalPaymentsSortField.Amount,
  [AdminPaymentsSortField.Provider]: InternalPaymentsSortField.Provider,
};

export function mapAdminPaymentsSortToInternal(
  sortBy: AdminPaymentsSortField,
): InternalPaymentsSortField | null {
  if (sortBy === AdminPaymentsSortField.Username) {
    return null;
  }

  return adminToInternalSortFieldMap[sortBy];
}

export function mapAdminPaymentsParamsToInternal(
  params: GetAdminPaymentsQueryParams,
  userIds?: number[],
): GetInternalPaymentsQueryParams {
  const sortBy: InternalPaymentsSortField =
    mapAdminPaymentsSortToInternal(params.sortBy) ?? InternalPaymentsSortField.Date;

  return {
    page: params.page,
    pageSize: params.pageSize,
    sortBy,
    sortDirection:
      params.sortDirection === AdminSortDirection.Ascending
        ? InternalPaymentsSortDirection.Ascending
        : InternalPaymentsSortDirection.Descending,
    userIds,
  };
}
