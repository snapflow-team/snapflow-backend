import { Param, ParseUUIDPipe } from '@nestjs/common';
import { NotFoundException } from '../../../../apps/snapflow-core/src/common/exceptions/domain-exceptions';

// todo: переместить в snapflow-core
export function ValidatedDeviceId(paramName = 'deviceId'): ParameterDecorator {
  return Param(
    paramName,
    new ParseUUIDPipe({
      exceptionFactory: () => new NotFoundException('Session not found'),
    }),
  );
}
