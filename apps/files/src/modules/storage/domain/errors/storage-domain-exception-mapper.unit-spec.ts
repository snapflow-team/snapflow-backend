import { HttpStatus } from '@nestjs/common';
import { StorageDomainExceptionCode } from './storage-domain-exception-codes';
import { StorageDomainExceptionCodeMapper } from './storage-domain-exception-mapper';
import {
  IdempotencyConflictException,
  InvalidOffsetException,
  InvalidProfileException,
  InvalidRangeException,
  ObjectNotReadyException,
  OwnershipMismatchException,
  QuotaExceededException,
  SessionExpiredException,
  StorageObjectNotFoundException,
  UnsupportedMimeTypeException,
} from './storage-domain-exceptions';
import { assertIdempotentPayload } from '../assert-idempotent-payload';

describe('StorageDomainExceptionCodeMapper', () => {
  const mapper = new StorageDomainExceptionCodeMapper();

  it.each([
    [StorageDomainExceptionCode.InvalidProfile, HttpStatus.BAD_REQUEST],
    [StorageDomainExceptionCode.InvalidRange, HttpStatus.BAD_REQUEST],
    [StorageDomainExceptionCode.InvalidOffset, HttpStatus.CONFLICT],
    [StorageDomainExceptionCode.UnsupportedMimeType, HttpStatus.UNSUPPORTED_MEDIA_TYPE],
    [StorageDomainExceptionCode.OwnershipMismatch, HttpStatus.FORBIDDEN],
    [StorageDomainExceptionCode.ObjectNotReady, HttpStatus.CONFLICT],
    [StorageDomainExceptionCode.QuotaExceeded, HttpStatus.TOO_MANY_REQUESTS],
    [StorageDomainExceptionCode.SessionExpired, HttpStatus.GONE],
    [StorageDomainExceptionCode.IdempotencyConflict, HttpStatus.CONFLICT],
    [StorageDomainExceptionCode.InvalidStateTransition, HttpStatus.CONFLICT],
    [StorageDomainExceptionCode.RefCountUnderflow, HttpStatus.CONFLICT],
    [StorageDomainExceptionCode.NotFound, HttpStatus.NOT_FOUND],
    [StorageDomainExceptionCode.BadRequest, HttpStatus.BAD_REQUEST],
  ] as const)('maps %s to HTTP %s', (code, status) => {
    expect(mapper.mapToHttpStatus(code)).toBe(status);
  });

  it('keeps stable RPC error codes on typed exceptions', () => {
    expect(new InvalidProfileException().code).toBe(StorageDomainExceptionCode.InvalidProfile);
    expect(new InvalidRangeException().code).toBe(StorageDomainExceptionCode.InvalidRange);
    expect(new InvalidOffsetException().code).toBe(StorageDomainExceptionCode.InvalidOffset);
    expect(new UnsupportedMimeTypeException().code).toBe(
      StorageDomainExceptionCode.UnsupportedMimeType,
    );
    expect(new OwnershipMismatchException().code).toBe(
      StorageDomainExceptionCode.OwnershipMismatch,
    );
    expect(new ObjectNotReadyException().code).toBe(StorageDomainExceptionCode.ObjectNotReady);
    expect(new QuotaExceededException().code).toBe(StorageDomainExceptionCode.QuotaExceeded);
    expect(new SessionExpiredException().code).toBe(StorageDomainExceptionCode.SessionExpired);
    expect(new IdempotencyConflictException().code).toBe(
      StorageDomainExceptionCode.IdempotencyConflict,
    );
    expect(new StorageObjectNotFoundException().code).toBe(StorageDomainExceptionCode.NotFound);
  });
});

describe('assertIdempotentPayload', () => {
  it('returns when the payload hash matches and conflicts otherwise', () => {
    expect(() => assertIdempotentPayload('aaa', 'aaa')).not.toThrow();
    expect(() => assertIdempotentPayload('aaa', 'bbb')).toThrow(IdempotencyConflictException);
  });
});
