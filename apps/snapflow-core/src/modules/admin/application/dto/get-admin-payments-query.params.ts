import { adminPaymentsQueryDefaults } from '../../constants/admin-query.defaults';
import { AdminSortDirection } from '../../domain/enums/admin-sort-direction.enum';
import { AdminPaymentsSortField } from '../../domain/enums/admin-payments-sort-field.enum';

export class GetAdminPaymentsQueryParams {
  page: number;
  pageSize: number;
  search?: string;
  sortBy: AdminPaymentsSortField;
  sortDirection: AdminSortDirection;

  constructor(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    sortBy?: AdminPaymentsSortField;
    sortDirection?: AdminSortDirection;
  }) {
    this.page = params.page ?? adminPaymentsQueryDefaults.page;
    this.pageSize = params.pageSize ?? adminPaymentsQueryDefaults.pageSize;
    this.search = params.search?.trim() || undefined;
    this.sortBy = params.sortBy ?? adminPaymentsQueryDefaults.sortBy;
    this.sortDirection = params.sortDirection ?? adminPaymentsQueryDefaults.sortDirection;
  }

  calculateSkip(): number {
    return (this.page - 1) * this.pageSize;
  }
}
