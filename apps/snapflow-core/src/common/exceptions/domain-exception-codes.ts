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
import { COMMON_CODES } from '../../../../../libs/exceptions/core/domain-exception-codes';

export const SNAPFLOW_CODES = {
  ...COMMON_CODES,
  EmailNotConfirmed: 'EmailNotConfirmed',
  ConfirmationCodeExpired: 'ConfirmationCodeExpired',
  PasswordRecoveryCodeExpired: 'PasswordRecoveryCodeExpired',
} as const;

export type SnapFlowDomainExceptionCode = (typeof SNAPFLOW_CODES)[keyof typeof SNAPFLOW_CODES];
