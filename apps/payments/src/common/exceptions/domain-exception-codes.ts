import { CommonDomainExceptionCode } from '../../../../../libs/exceptions/core';

export const PaymentsDomainExceptionCode = {
  ...CommonDomainExceptionCode,
} as const;

export type PaymentsDomainExceptionCodeType =
  (typeof PaymentsDomainExceptionCode)[keyof typeof PaymentsDomainExceptionCode];
