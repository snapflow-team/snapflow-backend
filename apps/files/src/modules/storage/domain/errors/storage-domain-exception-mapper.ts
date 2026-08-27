import { HttpStatus } from '@nestjs/common';
import { BaseDomainExceptionsCodeMapper } from '../../../../../../../libs/exceptions/core';
import {
  StorageDomainExceptionCode,
  StorageDomainExceptionCodeType,
} from './storage-domain-exception-codes';

export class StorageDomainExceptionCodeMapper extends BaseDomainExceptionsCodeMapper {
  mapToHttpStatus(code: StorageDomainExceptionCodeType): HttpStatus {
    switch (code) {
      case StorageDomainExceptionCode.InvalidProfile:
      case StorageDomainExceptionCode.InvalidRange:
        return HttpStatus.BAD_REQUEST;
      case StorageDomainExceptionCode.InvalidOffset:
      case StorageDomainExceptionCode.ObjectNotReady:
      case StorageDomainExceptionCode.IdempotencyConflict:
      case StorageDomainExceptionCode.InvalidStateTransition:
      case StorageDomainExceptionCode.RefCountUnderflow:
        return HttpStatus.CONFLICT;
      case StorageDomainExceptionCode.UnsupportedMimeType:
        return HttpStatus.UNSUPPORTED_MEDIA_TYPE;
      case StorageDomainExceptionCode.OwnershipMismatch:
        return HttpStatus.FORBIDDEN;
      case StorageDomainExceptionCode.QuotaExceeded:
        return HttpStatus.TOO_MANY_REQUESTS;
      case StorageDomainExceptionCode.SessionExpired:
        return HttpStatus.GONE;
      default:
        return super.mapToHttpStatus(code);
    }
  }
}
