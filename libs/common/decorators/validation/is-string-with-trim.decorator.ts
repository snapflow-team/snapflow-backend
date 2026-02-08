import { applyDecorators } from '@nestjs/common';
import { IsString, Length, ValidationOptions } from 'class-validator';
import { Trim } from '../transform/trim.decorator';

export const IsStringWithTrim = (
  minLength: number,
  maxLength: number,
  validationOptions?: ValidationOptions & {
    isStringMessage?: string;
    lengthMessage?: string;
  },
) =>
  applyDecorators(
    IsString({
      message: validationOptions?.isStringMessage || 'Must be a string',
    }),
    Length(minLength, maxLength, {
      message:
        validationOptions?.lengthMessage ||
        `Length must be between ${minLength} and ${maxLength} characters`,
    }),
    Trim(),
  );
