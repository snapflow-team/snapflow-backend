import { Param, ParseUUIDPipe } from '@nestjs/common';
import { DomainException } from '../../../exceptions/http/damain.exception';
import { DomainExceptionCode } from '../../../exceptions/core/domain-exception-codes';

export function ValidatedDeviceId(paramName = 'deviceId'): ParameterDecorator {
  return Param(
    paramName,
    new ParseUUIDPipe({
      exceptionFactory: () =>
        new DomainException({
          code: DomainExceptionCode.NotFound,
          message: 'Session not found',
        }),
    }),
  );
}
