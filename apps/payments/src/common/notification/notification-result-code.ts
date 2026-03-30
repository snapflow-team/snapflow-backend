import { CommonDomainExceptionCode } from '../../../../../libs/exceptions/core';

export const NotificationResultCode = {
  ...CommonDomainExceptionCode,
  Success: 'Success',
} as const;

export type NotificationResultCodeType =
  (typeof NotificationResultCode)[keyof typeof NotificationResultCode];
