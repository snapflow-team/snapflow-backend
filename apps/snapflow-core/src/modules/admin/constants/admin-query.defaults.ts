import { AdminPaymentsSortField } from '../domain/enums/admin-payments-sort-field.enum';
import { AdminSortDirection } from '../domain/enums/admin-sort-direction.enum';
import { AdminUsersBanStatusFilter } from '../domain/enums/admin-users-ban-status-filter.enum';
import { AdminUsersSortField } from '../domain/enums/admin-users-sort-field.enum';
import { AdminPostsSortField } from '../domain/enums/admin-posts-sort-field.enum';

export const adminUsersQueryDefaults = {
  page: 1,
  pageSize: 8,
  sortBy: AdminUsersSortField.CreatedAt,
  sortDirection: AdminSortDirection.Descending,
  banStatusFilter: AdminUsersBanStatusFilter.NotSelected,
} as const;

export const adminPaymentsQueryDefaults = {
  page: 1,
  pageSize: 6,
  sortBy: AdminPaymentsSortField.Date,
  sortDirection: AdminSortDirection.Descending,
} as const;

export const adminPostsQueryDefaults = {
  page: 1,
  pageSize: 10,
  sortBy: AdminPostsSortField.CreatedAt,
  sortDirection: AdminSortDirection.Descending,
} as const;
