export abstract class PaginatedViewDto<T> {
  pagesCount: number;
  page: number;
  pageSize: number;
  totalCount: number;
  abstract items: T[];
}
