import { CommonDomainExceptionCode } from '../../../../../../../libs/exceptions/core';

export const StorageDomainExceptionCode = {
  ...CommonDomainExceptionCode,
  InvalidProfile: 'InvalidProfile',
  InvalidRange: 'InvalidRange',
  InvalidOffset: 'InvalidOffset',
  UnsupportedMimeType: 'UnsupportedMimeType',
  OwnershipMismatch: 'OwnershipMismatch',
  ObjectNotReady: 'ObjectNotReady',
  QuotaExceeded: 'QuotaExceeded',
  SessionExpired: 'SessionExpired',
  IdempotencyConflict: 'IdempotencyConflict',
  InvalidStateTransition: 'InvalidStateTransition',
  RefCountUnderflow: 'RefCountUnderflow',
} as const;

export type StorageDomainExceptionCodeType =
  (typeof StorageDomainExceptionCode)[keyof typeof StorageDomainExceptionCode];
