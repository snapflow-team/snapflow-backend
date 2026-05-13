import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum SortDirection {
  Ascending = 'asc',
  Descending = 'desc',
}

export abstract class BaseQueryParams<T> {
  @Type(() => Number)
  @IsNumber()
  pageNumber: number = 1;

  @IsNumber()
  @Type(() => Number)
  pageSize: number = 10;

  @ApiPropertyOptional({
    enum: SortDirection,
    default: SortDirection.Descending,
    example: SortDirection.Descending,
  })
  @IsOptional()
  @IsEnum(SortDirection)
  sortDirection: SortDirection = SortDirection.Descending;

  abstract sortBy: T;

  calculateSkip(): number {
    return (this.pageNumber - 1) * this.pageSize;
  }
}
