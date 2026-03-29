import { CommonDomainExceptionCode } from '../../../../../libs/exceptions/core';

export const PaymentsDomainExceptionCode = {
  ...CommonDomainExceptionCode,
  Success: 'Success',
} as const;

export type PaymentsDomainExceptionCodeType =
  (typeof PaymentsDomainExceptionCode)[keyof typeof PaymentsDomainExceptionCode];
