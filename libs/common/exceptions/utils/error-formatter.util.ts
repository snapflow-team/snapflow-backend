import { ValidationError } from '@nestjs/common';

export interface ValidationErrorDetail {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Рекурсивно преобразует иерархическую структуру ошибок NestJS (ValidationError[])
 * в плоский массив объектов ValidationErrorDetail.
 *
 * @param errors - Массив объектов ValidationError, обычно возвращаемый ValidationPipe.
 * @param parentPath - Вспомогательный параметр для отслеживания пути вложенных свойств (используется при рекурсии).
 * @returns Плоский массив объектов с информацией об ошибках.
 *
 * @description
 * 1. Обрабатывает вложенные объекты и массивы рекурсивно, формируя путь через точку (dot-notation).
 * 2. Извлекает все нарушения ограничений (constraints) для каждого поля.
 * 3. Безопасность: Поле `value` добавляется в результат только если `process.env.NODE_ENV` не равно 'production'.
 */
export const formatValidationErrors = (errors: ValidationError[], parentPath = '') => {
  return errors.reduce((acc: ValidationErrorDetail[], error): ValidationErrorDetail[] => {
    const isProduction: boolean = process.env.NODE_ENV === 'production';

    const path: string = parentPath ? `${parentPath}.${error.property}` : error.property;

    if (error.constraints) {
      Object.values(error.constraints).forEach((message) => {
        const errorDetail: ValidationErrorDetail = {
          field: path,
          message,
        };

        if (!isProduction) {
          errorDetail.value = error.value;
        }

        acc.push(errorDetail);
      });
    }

    if (error.children?.length) {
      acc.push(...formatValidationErrors(error.children, path));
    }

    return acc;
  }, []);
};
