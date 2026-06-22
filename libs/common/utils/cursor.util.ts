import { ValidationException } from '../../exceptions/core';

export type CursorPayload = {
  createdAt: string;
  id: string;
};

const INVALID_CURSOR_MESSAGE = 'Invalid cursor';

/**
 * Opaque cursor для keyset-пагинации time-sorted сущностей.
 *
 * Prisma guideline (для будущих endpoint-реализаций):
 * - orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
 * - take: limit + 1
 * - where (если cursor задан): (createdAt < cursor.createdAt) OR
 *   (createdAt = cursor.createdAt AND id < cursor.id)
 * - если получено limit + 1: hasMore = true, items = first(limit),
 *   nextCursor = encodeCursor(lastItem)
 * - иначе: hasMore = false, nextCursor = null
 */
function throwInvalidCursor(): never {
  throw new ValidationException([{ field: 'cursor', message: INVALID_CURSOR_MESSAGE }]);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidCursorPayload(value: unknown): value is CursorPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Record<string, unknown>;

  if (!isNonEmptyString(payload.createdAt) || !isNonEmptyString(payload.id)) {
    return false;
  }

  return !Number.isNaN(Date.parse(payload.createdAt));
}

export function encodeCursor(payload: { createdAt: Date | string; id: string }): string {
  const createdAt =
    payload.createdAt instanceof Date ? payload.createdAt.toISOString() : payload.createdAt;

  const cursorPayload: CursorPayload = {
    createdAt,
    id: payload.id,
  };

  return Buffer.from(JSON.stringify(cursorPayload), 'utf8').toString('base64');
}

export function decodeCursor(cursor: string): CursorPayload {
  const trimmedCursor = cursor.trim();

  if (!trimmedCursor) {
    throwInvalidCursor();
  }

  let decoded: string;

  try {
    decoded = Buffer.from(trimmedCursor, 'base64').toString('utf8');
  } catch {
    throwInvalidCursor();
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(decoded);
  } catch {
    throwInvalidCursor();
  }

  if (!isValidCursorPayload(parsed)) {
    throwInvalidCursor();
  }

  return parsed;
}
