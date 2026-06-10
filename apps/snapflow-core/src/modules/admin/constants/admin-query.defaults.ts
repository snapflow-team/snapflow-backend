import { AdminPaymentsSortField } from '../domain/enums/admin-payments-sort-field.enum';
import { AdminSortDirection } from '../domain/enums/admin-sort-direction.enum';
import { AdminUsersSortField } from '../domain/enums/admin-users-sort-field.enum';

export const ADMIN_DEFAULT_PAGE = 1;
export const ADMIN_DEFAULT_PAGE_SIZE = 8;
export const ADMIN_DEFAULT_SORT_DIRECTION = AdminSortDirection.Descending;
export const ADMIN_DEFAULT_USERS_SORT_BY = AdminUsersSortField.CreatedAt;
export const ADMIN_DEFAULT_PAYMENTS_SORT_BY = AdminPaymentsSortField.CreatedAt;
