import { CommonDomainExceptionCode } from '../../../../../libs/exceptions/core';

export const MessengerResultCode = {
  ...CommonDomainExceptionCode,
  Success: 'Success',
} as const;

export type MessengerResultCodeType =
  (typeof MessengerResultCode)[keyof typeof MessengerResultCode];
