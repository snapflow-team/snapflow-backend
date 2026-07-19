import { CommonDomainExceptionCode } from '../../../../../libs/exceptions/core';

export const MessengerResultCode = {
  ...CommonDomainExceptionCode,
  Success: 'Success',
  MessageNotFound: 'MessageNotFound',
  EditWindowExpired: 'EditWindowExpired',
  DeleteWindowExpired: 'DeleteWindowExpired',
  ReplyTargetInvalid: 'ReplyTargetInvalid',
} as const;

export type MessengerResultCodeType =
  (typeof MessengerResultCode)[keyof typeof MessengerResultCode];
