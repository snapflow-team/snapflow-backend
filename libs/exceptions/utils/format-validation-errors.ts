import { ValidationError } from '@nestjs/common';
import { Extension } from '../damain.exception';

/**
 * Преобразует ValidationError[] из class-validator
 * в плоский массив Domain Extension[]
 */
export const formatValidationErrors = (errors: ValidationError[], parentPath = ''): Extension[] => {
  return errors.reduce<Extension[]>((acc: Extension[], error: ValidationError) => {
    const path: string = parentPath ? `${parentPath}.${error.property}` : error.property;

    if (error.constraints) {
      for (const message of Object.values(error.constraints)) {
        acc.push(new Extension({ field: path, message }));
      }
    }

    if (error.children?.length) {
      acc.push(...formatValidationErrors(error.children, path));
    }

    return acc;
  }, []);
};
