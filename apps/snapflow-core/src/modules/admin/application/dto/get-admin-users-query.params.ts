import {
  ADMIN_DEFAULT_PAGE,
  ADMIN_DEFAULT_PAGE_SIZE,
  ADMIN_DEFAULT_SORT_DIRECTION,
  ADMIN_DEFAULT_USERS_SORT_BY,
} from '../../constants/admin-query.defaults';
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
    this.page = params.page ?? ADMIN_DEFAULT_PAGE;
    this.pageSize = params.pageSize ?? ADMIN_DEFAULT_PAGE_SIZE;
    this.search = params.search?.trim() || undefined;
    this.sortBy = params.sortBy ?? ADMIN_DEFAULT_USERS_SORT_BY;
    this.sortDirection = params.sortDirection ?? ADMIN_DEFAULT_SORT_DIRECTION;
  }

  calculateSkip(): number {
    return (this.page - 1) * this.pageSize;
  }

  getPrismaOrderBy(): Record<AdminUsersSortField, AdminSortDirection> {
    return { [this.sortBy]: this.sortDirection } as Record<AdminUsersSortField, AdminSortDirection>;
  }
}
