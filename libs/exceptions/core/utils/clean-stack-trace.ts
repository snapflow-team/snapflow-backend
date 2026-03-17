/**
 * Очищает и форматирует стек вызовов (stack trace) ошибки для улучшения читаемости логов.
 *
 * Функция удаляет визуальный "мусор" из стека, оставляя только самую важную информацию
 * для дебаггинга. Она сохраняет сообщение об ошибке, первоисточник падения и цепочку
 * вызовов внутри файлов текущего проекта.
 *
 * @description
 * Алгоритм очистки:
 * 1. Сохраняет строку [0] (само сообщение об ошибке, напр. `Error: something went wrong`).
 * 2. Сохраняет строку [1] (первоисточник ошибки), даже если она находится в `node_modules`.
 * 3. Удаляет все внутренние вызовы ядра Node.js (строки, содержащие `(node:`).
 * 4. Удаляет все промежуточные вызовы из сторонних библиотек (строки с `node_modules`).
 * 5. Преобразует абсолютные пути в относительные, удаляя путь к корню проекта.
 *
 * @example
 * // ДО ОЧИСТКИ:
 * // Error: Input file is missing
 * //   at Sharp.toBuffer (/home/app/node_modules/sharp/output.js:163)
 * //   at UploadUseCase.execute (/home/app/dist/use-cases/upload.js:42)
 * //   at CommandBus.execute (/home/app/node_modules/@nestjs/cqrs/bus.js:81)
 * //   at async ServerTCP.handleMessage (node:internal/process/task_queues:103)
 *
 * const clean = cleanStackTrace(error.stack);
 *
 * // ПОСЛЕ ОЧИСТКИ:
 * // Error: Input file is missing
 * //   at Sharp.toBuffer (/node_modules/sharp/output.js:163)
 * //   at UploadUseCase.execute (/dist/use-cases/upload.js:42)
 *
 * @param stack {string | undefined} Оригинальный стек вызовов (обычно `error.stack`).
 * @returns {string} Очищенная строка стека. Если передан пустой стек, возвращает пустую строку.
 */
export function cleanStackTrace(stack?: string): string {
  if (!stack) return '';

  const projectRoot = process.cwd();

  return stack
    .split('\n')
    .filter((line, index) => {
      if (index === 0) return true;

      if (index === 1) return true;

      if (line.includes('(node:')) return false;

      if (line.includes('node_modules')) return false;

      return true;
    })
    .map((line) => {
      return line.replace(projectRoot, '');
    })
    .join('\n');
}
