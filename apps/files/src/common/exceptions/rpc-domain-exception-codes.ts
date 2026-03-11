import { CommonDomainExceptionCode } from '../../../../../libs/exceptions/core';

export const SnapFlowRpcDomainExceptionCode = {
  ...CommonDomainExceptionCode,
  EmailNotConfirmed: 'EmailNotConfirmed',
  ConfirmationCodeExpired: 'ConfirmationCodeExpired',
} as const;

export type SnapFlowRpcDomainExceptionCodeType =
  (typeof SnapFlowRpcDomainExceptionCode)[keyof typeof SnapFlowRpcDomainExceptionCode];
