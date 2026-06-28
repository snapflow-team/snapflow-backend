import { adminPostsQueryDefaults } from '../../constants/admin-query.defaults';
import { AdminSortDirection } from '../../domain/enums/admin-sort-direction.enum';
import { AdminUsersSortField } from '../../domain/enums/admin-users-sort-field.enum';
import { AdminPostsSortField } from '../../domain/enums/admin-posts-sort-field.enum';

export class GetAdminPostsQueryParams {
  page: number;
  pageSize: number;
  search?: string;
  sortBy: AdminPostsSortField;
  sortDirection: AdminSortDirection;

  constructor(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    sortBy?: AdminPostsSortField;
    sortDirection?: AdminSortDirection;
  }) {
    this.page = params.page ?? adminPostsQueryDefaults.page;
    this.pageSize = params.pageSize ?? adminPostsQueryDefaults.pageSize;
    this.search = params.search?.trim() || undefined;
    this.sortBy = params.sortBy ?? adminPostsQueryDefaults.sortBy;
    this.sortDirection = params.sortDirection ?? adminPostsQueryDefaults.sortDirection;
  }

  calculateSkip(): number {
    return (this.page - 1) * this.pageSize;
  }

  getPrismaOrderBy(): Record<AdminUsersSortField, AdminSortDirection> {
    return { [this.sortBy]: this.sortDirection } as Record<AdminUsersSortField, AdminSortDirection>;
  }
}
