import { ValidationError } from '@nestjs/common';
import { RpcValidationError } from './rpc-error-response';

export const formatRpcValidationErrors = (errors: ValidationError[]): RpcValidationError[] => {
  return errors.reduce<RpcValidationError[]>((acc, error) => {
    const path = error.property;

    if (error.constraints) {
      for (const message of Object.values(error.constraints)) {
        acc.push({ field: path, message });
      }
    }

    if (error.children?.length) {
      acc.push(...formatRpcValidationErrors(error.children));
    }

    return acc;
  }, []);
};
