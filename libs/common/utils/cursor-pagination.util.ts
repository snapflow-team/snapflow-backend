import { type CursorPayload, encodeCursor } from './cursor.util';

/**
 * Единый Prisma keyset-паттерн cursor-пагинации для time-sorted сущностей.
 *
 * Использовать вместе с:
 * - `CursorQueryParamsDto` / `CursorPaginatedViewDto` (`libs/dto`)
 * - `encodeCursor` / `decodeCursor` (`cursor.util.ts`)
 *
 * ## Prisma findMany
 *
 * 1. Декодировать cursor (если передан): `decodeCursor(query.cursor)`
 * 2. Собрать `where`: базовые фильтры + `buildKeysetCursorFilter(...)` при наличии cursor
 * 3. `orderBy`: `KEYSET_ORDER_BY_CREATED_AT_DESC`
 * 4. `take`: `getKeysetTake(query.limit)` — всегда `limit + 1` для определения `hasMore`
 * 5. Ответ: `buildCursorPaginatedResult(rows, query.limit, toCursorPayload)`
 *
 * ## Tuple-сравнение (эквивалент SQL)
 *
 * `(createdAt < cursor.createdAt) OR (createdAt = cursor.createdAt AND id < cursor.id)`
 *
 * Сортировка всегда `createdAt desc`, затем `id desc`.
 *
 * ## Пример (query-repository)
 *
 * ```ts
 * const { cursor, limit } = query;
 * const cursorPayload = cursor ? decodeCursor(cursor) : undefined;
 *
 * const rows = await this.prisma.postLike.findMany({
 *   where: {
 *     deletedAt: null,
 *     postId,
 *     ...(cursorPayload
 *       ? buildKeysetCursorFilter(cursorPayload, { parseId: Number })
 *       : {}),
 *   },
 *   orderBy: KEYSET_ORDER_BY_CREATED_AT_DESC,
 *   take: getKeysetTake(limit),
 * });
 *
 * return buildCursorPaginatedResult(rows, limit, (item) => ({
 *   createdAt: item.createdAt,
 *   id: String(item.id),
 * }));
 * ```
 *
 * Не добавлять `totalCount` / `pagesCount` в cursor-ответы.
 * Существующие offset-эндпоинты не менять.
 */
export const KEYSET_ORDER_BY_CREATED_AT_DESC = [{ createdAt: 'desc' }, { id: 'desc' }] as const;

export type CursorPaginatedResult<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type KeysetCursorFilterOptions = {
  /**
   * Преобразует id из opaque cursor в тип поля Prisma-модели.
   * Для `Int` id передайте `Number`, для `String`/`Uuid` — не передавайте (по умолчанию string).
   */
  parseId?: (id: string) => string | number;
};

export function getKeysetTake(limit: number): number {
  return limit + 1;
}

/**
 * Prisma-совместимый фильтр для keyset-пагинации по `(createdAt, id)`.
 * Разворачивать в `where` через spread: `{ ...baseWhere, ...buildKeysetCursorFilter(...) }`.
 */
export function buildKeysetCursorFilter(
  cursor: CursorPayload,
  options?: KeysetCursorFilterOptions,
): { OR: Array<Record<string, unknown>> } {
  const id: string | number = options?.parseId ? options.parseId(cursor.id) : cursor.id;
  const createdAt = new Date(cursor.createdAt);

  return {
    OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: id } }],
  };
}

/**
 * Обрезает `limit + 1` строк до `limit`, вычисляет `hasMore` и `nextCursor`.
 */
export function buildCursorPaginatedResult<T>(
  rows: T[],
  limit: number,
  toCursorPayload: (item: T) => { createdAt: Date | string; id: string },
): CursorPaginatedResult<T> {
  const hasMore: boolean = rows.length > limit;
  const items: T[] = hasMore ? rows.slice(0, limit) : rows;
  const lastItem: T | undefined = items.at(-1);

  return {
    items,
    hasMore,
    nextCursor: hasMore && lastItem ? encodeCursor(toCursorPayload(lastItem)) : null,
  };
}
