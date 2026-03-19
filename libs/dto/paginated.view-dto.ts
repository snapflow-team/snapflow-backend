import { ApiProperty } from '@nestjs/swagger';

export abstract class PaginatedViewDto<T> {
  @ApiProperty({ required: false, example: 1 })
  pagesCount: number;

  @ApiProperty({ required: false, example: 1 })
  page: number;

  @ApiProperty({ required: false, example: 10 })
  pageSize: number;

  @ApiProperty({ required: false, example: 1 })
  totalCount: number;
  @ApiProperty({ isArray: true })
  items: T[];

  static mapToView<T>(data: {
    items: T[];
    page: number;
    size: number;
    totalCount: number;
  }): PaginatedViewDto<T> {
    return {
      pageSize: data.size,
      page: data.page,
      totalCount: data.totalCount,
      pagesCount: Math.ceil(data.totalCount / data.size),
      items: data.items,
    };
  }
}
