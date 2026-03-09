import { ValidationError } from '@nestjs/common';
import { IExtension } from '../domain-exception';

/**
 * Универсальная функция для любого IExtension
 */
export function formatValidationErrors<TExtension extends IExtension>(
  errors: ValidationError[],
  parentPath: string = '',
): TExtension[] {
  return errors.reduce<TExtension[]>((acc: TExtension[], error: ValidationError) => {
    const path: string = parentPath ? `${parentPath}.${error.property}` : error.property;

    if (error.constraints) {
      for (const message of Object.values(error.constraints)) {
        acc.push({ field: path, message } as TExtension);
      }
    }

    if (error.children?.length) {
      const childErrors: IExtension[] = formatValidationErrors<IExtension>(error.children, path);
      acc.push(...(childErrors as TExtension[]));
    }

    return acc;
  }, []);
}
