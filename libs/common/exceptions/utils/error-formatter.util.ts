import { ValidationError } from '@nestjs/common';

export interface ValidationErrorDetail {
  field: string;
  message: string;
  value?: unknown;
}

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
