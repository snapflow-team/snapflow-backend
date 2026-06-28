import {
  buildCursorPaginatedResult,
  buildKeysetCursorFilter,
  getKeysetTake,
  KEYSET_ORDER_BY_CREATED_AT_DESC,
} from './cursor-pagination.util';

describe('Утилиты cursor keyset-пагинации (Prisma guideline)', () => {
  describe('KEYSET_ORDER_BY_CREATED_AT_DESC', () => {
    it('фиксирует единый порядок сортировки createdAt desc, id desc', () => {
      expect(KEYSET_ORDER_BY_CREATED_AT_DESC).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
    });
  });

  describe('getKeysetTake', () => {
    it('возвращает limit + 1 для определения hasMore', () => {
      expect(getKeysetTake(8)).toBe(9);
      expect(getKeysetTake(1)).toBe(2);
    });
  });

  describe('buildKeysetCursorFilter', () => {
    it('строит tuple-фильтр для string id', () => {
      const createdAt = '2024-01-01T00:00:00.000Z';

      expect(buildKeysetCursorFilter({ createdAt, id: 'abc' })).toEqual({
        OR: [
          { createdAt: { lt: new Date(createdAt) } },
          { createdAt: new Date(createdAt), id: { lt: 'abc' } },
        ],
      });
    });

    it('применяет parseId для числовых Prisma id', () => {
      const createdAt = '2024-06-15T12:30:00.000Z';

      expect(buildKeysetCursorFilter({ createdAt, id: '42' }, { parseId: Number })).toEqual({
        OR: [
          { createdAt: { lt: new Date(createdAt) } },
          { createdAt: new Date(createdAt), id: { lt: 42 } },
        ],
      });
    });
  });

  describe('buildCursorPaginatedResult', () => {
    const toCursorPayload = (item: { createdAt: Date; id: number }) => ({
      createdAt: item.createdAt,
      id: String(item.id),
    });

    it('первая загрузка: hasMore=true и nextCursor из последнего элемента страницы', () => {
      const rows = [
        { createdAt: new Date('2024-01-03T00:00:00.000Z'), id: 3 },
        { createdAt: new Date('2024-01-02T00:00:00.000Z'), id: 2 },
        { createdAt: new Date('2024-01-01T00:00:00.000Z'), id: 1 },
      ];

      const result = buildCursorPaginatedResult(rows, 2, toCursorPayload);

      expect(result.hasMore).toBe(true);
      expect(result.items).toHaveLength(2);
      expect(result.items).toEqual(rows.slice(0, 2));
      expect(result.nextCursor).toBe(
        'eyJjcmVhdGVkQXQiOiIyMDI0LTAxLTAyVDAwOjAwOjAwLjAwMFoiLCJpZCI6IjIifQ==',
      );
    });

    it('последняя страница: hasMore=false и nextCursor=null', () => {
      const rows = [{ createdAt: new Date('2024-01-01T00:00:00.000Z'), id: 1 }];

      const result = buildCursorPaginatedResult(rows, 2, toCursorPayload);

      expect(result.hasMore).toBe(false);
      expect(result.items).toEqual(rows);
      expect(result.nextCursor).toBeNull();
    });

    it('пустой результат: hasMore=false, items=[], nextCursor=null', () => {
      const result = buildCursorPaginatedResult([], 8, toCursorPayload);

      expect(result).toEqual({
        items: [],
        hasMore: false,
        nextCursor: null,
      });
    });
  });
});
