import { ApiProperty } from '@nestjs/swagger';

/**
 * Базовый cursor-ответ. Не включает totalCount/pagesCount.
 * Prisma keyset-паттерн для заполнения — `libs/common/utils/cursor-pagination.util.ts`.
 */
export abstract class CursorPaginatedViewDto<T> {
  @ApiProperty({
    description: 'Элементы текущей страницы',
    isArray: true,
  })
  items: T[];

  @ApiProperty({
    nullable: true,
    description: 'Opaque cursor для следующей страницы. null, если элементов больше нет.',
    example: 'eyJjcmVhdGVkQXQiOiIyMDI0LTAxLTAxVDAwOjAwOjAwLjAwMFoiLCJpZCI6IjEyMyJ9',
  })
  nextCursor: string | null;

  @ApiProperty({
    description: 'Есть ли ещё элементы после текущей страницы',
    example: true,
  })
  hasMore: boolean;
}
