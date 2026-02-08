import { Transform, TransformFnParams } from 'class-transformer';

export const Trim = (): PropertyDecorator => {
  return Transform(({ value }: TransformFnParams): unknown => {
    return typeof value === 'string' ? value.trim() : value;
  });
};
