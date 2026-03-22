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
}
