import { adminUsersQueryDefaults } from '../../constants/admin-query.defaults';
import { AdminSortDirection } from '../../domain/enums/admin-sort-direction.enum';
import { AdminUsersSortField } from '../../domain/enums/admin-users-sort-field.enum';

export class GetAdminUsersQueryParams {
  page: number;
  pageSize: number;
  search?: string;
  sortBy: AdminUsersSortField;
  sortDirection: AdminSortDirection;

  constructor(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    sortBy?: AdminUsersSortField;
    sortDirection?: AdminSortDirection;
  }) {
    this.page = params.page ?? adminUsersQueryDefaults.page;
    this.pageSize = params.pageSize ?? adminUsersQueryDefaults.pageSize;
    this.search = params.search?.trim() || undefined;
    this.sortBy = params.sortBy ?? adminUsersQueryDefaults.sortBy;
    this.sortDirection = params.sortDirection ?? adminUsersQueryDefaults.sortDirection;
  }

  calculateSkip(): number {
    return (this.page - 1) * this.pageSize;
  }

  getPrismaOrderBy(): Record<AdminUsersSortField, AdminSortDirection> {
    return { [this.sortBy]: this.sortDirection } as Record<AdminUsersSortField, AdminSortDirection>;
  }
}
