import { Param, ParseUUIDPipe } from '@nestjs/common';
import { NotFoundException } from '../../../../../common/exceptions/domain-exceptions';

export function ValidatedDeviceId(paramName = 'deviceId'): ParameterDecorator {
  return Param(
    paramName,
    new ParseUUIDPipe({
      exceptionFactory: () => new NotFoundException('Session not found'),
    }),
  );
}
