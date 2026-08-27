import { DomainException, IExtension } from '../../../../../../../libs/exceptions/core';
import {
  StorageDomainExceptionCode,
  StorageDomainExceptionCodeType,
} from './storage-domain-exception-codes';

export class StorageDomainException extends DomainException<StorageDomainExceptionCodeType> {
  constructor(code: StorageDomainExceptionCodeType, message: string, extensions?: IExtension[]) {
    super({ code, message, extensions });
  }
}

export class InvalidProfileException extends StorageDomainException {
  constructor(message: string = 'Storage profile is invalid') {
    super(StorageDomainExceptionCode.InvalidProfile, message);
  }
}

export class InvalidRangeException extends StorageDomainException {
  constructor(message: string = 'Upload range is invalid') {
    super(StorageDomainExceptionCode.InvalidRange, message);
  }
}

export class InvalidOffsetException extends StorageDomainException {
  constructor(message: string = 'Upload offset does not match the persisted offset') {
    super(StorageDomainExceptionCode.InvalidOffset, message);
  }
}

export class UnsupportedMimeTypeException extends StorageDomainException {
  constructor(message: string = 'MIME type is not allowed for this profile') {
    super(StorageDomainExceptionCode.UnsupportedMimeType, message);
  }
}

export class OwnershipMismatchException extends StorageDomainException {
  constructor(message: string = 'Object does not belong to the requested owner') {
    super(StorageDomainExceptionCode.OwnershipMismatch, message);
  }
}

export class ObjectNotReadyException extends StorageDomainException {
  constructor(message: string = 'Object is not ready') {
    super(StorageDomainExceptionCode.ObjectNotReady, message);
  }
}

export class QuotaExceededException extends StorageDomainException {
  constructor(message: string = 'Upload quota exceeded') {
    super(StorageDomainExceptionCode.QuotaExceeded, message);
  }
}

export class SessionExpiredException extends StorageDomainException {
  constructor(message: string = 'Upload session has expired') {
    super(StorageDomainExceptionCode.SessionExpired, message);
  }
}

export class IdempotencyConflictException extends StorageDomainException {
  constructor(message: string = 'Idempotency key was reused with a different payload') {
    super(StorageDomainExceptionCode.IdempotencyConflict, message);
  }
}

export class InvalidStateTransitionException extends StorageDomainException {
  constructor(message: string = 'Invalid storage object state transition') {
    super(StorageDomainExceptionCode.InvalidStateTransition, message);
  }
}

export class RefCountUnderflowException extends StorageDomainException {
  constructor(message: string = 'Reference count cannot go below zero') {
    super(StorageDomainExceptionCode.RefCountUnderflow, message);
  }
}

export class StorageObjectNotFoundException extends StorageDomainException {
  constructor(message: string = 'Storage object not found') {
    super(StorageDomainExceptionCode.NotFound, message);
  }
}

export class UploadSessionNotFoundException extends StorageDomainException {
  constructor(message: string = 'Upload session not found') {
    super(StorageDomainExceptionCode.NotFound, message);
  }
}
