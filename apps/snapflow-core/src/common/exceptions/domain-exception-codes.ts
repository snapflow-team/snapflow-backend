// import { CommonDomainExceptionCode } from '../../../../../libs/exceptions/core/domain-exception-codes';
//
// export enum SnapFlowDomainExceptionCodes {
//   EmailNotConfirmed = 'EmailNotConfirmed',
//   ConfirmationCodeExpired = 'ConfirmationCodeExpired',
//   PasswordRecoveryCodeExpired = 'PasswordRecoveryCodeExpired',
// }
//
// export type SnapFlowDomainExceptionCodesTypy =
//   | CommonDomainExceptionCode
//   | SnapFlowDomainExceptionCodes;

import { CommonDomainExceptionCode } from '../../../../../libs/exceptions/core';

export const SnapFlowDomainExceptionCode = {
  ...CommonDomainExceptionCode,
  EmailNotConfirmed: 'EmailNotConfirmed',
  ConfirmationCodeExpired: 'ConfirmationCodeExpired',
  PasswordRecoveryCodeExpired: 'PasswordRecoveryCodeExpired',
} as const;

export type SnapFlowDomainExceptionCodeType =
  (typeof SnapFlowDomainExceptionCode)[keyof typeof SnapFlowDomainExceptionCode];
