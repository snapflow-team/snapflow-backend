// export const CommonDomainExceptionCode {
//   ValidationError = 'ValidationError',
//   BadRequest = 'BadRequest',
//   Unauthorized = 'Unauthorized',
//   Forbidden = 'Forbidden',
//   NotFound = 'NotFound',
//   InternalServerError = 'InternalServerError',
// }
//
// export type DomainExceptionCode = CommonDomainExceptionCode;

export const COMMON_CODES = {
  ValidationError: 'ValidationError',
  BadRequest: 'BadRequest',
  Forbidden: 'Forbidden',
  NotFound: 'NotFound',
  InternalServerError: 'InternalServerError',
  Unauthorized: 'Unauthorized',
} as const;

export type CommonDomainExceptionCode = typeof COMMON_CODES[keyof typeof COMMON_CODES];

// export enum DomainExceptionCode {
//   //common
//   ValidationError = 'ValidationError',
//   BadRequest = 'BadRequest',
//   Forbidden = 'Forbidden',
//   NotFound = 'NotFound',
//   InternalServerError = 'InternalServerError',
//   //auth
//   Unauthorized = 'Unauthorized',
//   EmailNotConfirmed = 'EmailNotConfirmed',
//   ConfirmationCodeExpired = 'ConfirmationCodeExpired',
//   PasswordRecoveryCodeExpired = 'PasswordRecoveryCodeExpired',
// }
