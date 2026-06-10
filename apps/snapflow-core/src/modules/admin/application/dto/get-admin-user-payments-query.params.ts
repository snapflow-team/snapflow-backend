import {
  ADMIN_DEFAULT_PAGE,
  ADMIN_DEFAULT_PAGE_SIZE,
  ADMIN_DEFAULT_PAYMENTS_SORT_BY,
  ADMIN_DEFAULT_SORT_DIRECTION,
} from '../../constants/admin-query.defaults';
import { AdminSortDirection } from '../../domain/enums/admin-sort-direction.enum';
import { AdminPaymentsSortField } from '../../domain/enums/admin-payments-sort-field.enum';

export class GetAdminUserPaymentsQueryParams {
  page: number;
  pageSize: number;
  sortBy: AdminPaymentsSortField;
  sortDirection: AdminSortDirection;

  constructor(params: {
    page?: number;
    pageSize?: number;
    sortBy?: AdminPaymentsSortField;
    sortDirection?: AdminSortDirection;
  }) {
    this.page = params.page ?? ADMIN_DEFAULT_PAGE;
    this.pageSize = params.pageSize ?? ADMIN_DEFAULT_PAGE_SIZE;
    this.sortBy = params.sortBy ?? ADMIN_DEFAULT_PAYMENTS_SORT_BY;
    this.sortDirection = params.sortDirection ?? ADMIN_DEFAULT_SORT_DIRECTION;
  }

  toHttpQueryParams(): {
    pageNumber: number;
    pageSize: number;
    sortBy: string;
    sortDirection: string;
  } {
    return {
      pageNumber: this.page,
      pageSize: this.pageSize,
      sortBy: this.sortBy,
      sortDirection: this.sortDirection,
    };
  }
}
