type SerializedError = {
  message: string;
  stack?: string;
};

/**
 * Безопасно сериализует произвольное значение в строку.
 * Если JSON.stringify бросает исключение (например, из-за циклических ссылок),
 * используется строковое представление через String(...).
 */
function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Приводит ошибку или произвольное значение к единому формату для логирования.
 *
 * Для экземпляров Error возвращает:
 * - `message` в виде `ErrorName: message`
 * - `stack` без обрезки
 * - дополнительные хвосты `cause` и `extra` (если присутствуют)
 *
 * Для строк возвращает их как есть.
 * Для остальных значений использует безопасную JSON-сериализацию.
 */
export function serializeError(input: unknown): SerializedError {
  if (input instanceof Error) {
    const { name, message, stack, cause, ...rest } = input as Error & {
      cause?: unknown;
      [key: string]: unknown;
    };

    const causePart = cause !== undefined ? `; cause: ${safeJson(cause)}` : '';
    const restPart = Object.keys(rest).length > 0 ? `; extra: ${safeJson(rest)}` : '';

    return {
      message: `${name}: ${message}${causePart}${restPart}`,
      stack,
    };
  }

  if (typeof input === 'string') {
    return { message: input };
  }

  return { message: safeJson(input) };
}
