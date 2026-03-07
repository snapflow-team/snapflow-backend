import { HttpStatus } from '@nestjs/common';
import { CommonDomainExceptionCode } from '../../core/domain-exception-codes';

export interface IDomainCodeMapper<TCode = CommonDomainExceptionCode> {
  mapToHttpStatus(code: TCode): HttpStatus;
}

export class BaseDomainExceptionsCodeMapper implements IDomainCodeMapper {
  mapToHttpStatus(code: CommonDomainExceptionCode): number {
    switch (code) {
      case CommonDomainExceptionCode.BadRequest:
      case CommonDomainExceptionCode.ValidationError:
        return HttpStatus.BAD_REQUEST;
      case CommonDomainExceptionCode.Forbidden:
        return HttpStatus.FORBIDDEN;
      case CommonDomainExceptionCode.NotFound:
        return HttpStatus.NOT_FOUND;
      case CommonDomainExceptionCode.Unauthorized:
        return HttpStatus.UNAUTHORIZED;
      case CommonDomainExceptionCode.InternalServerError:
        return HttpStatus.INTERNAL_SERVER_ERROR;
      default:
        return HttpStatus.I_AM_A_TEAPOT;
    }
  }
}
