export enum DomainExceptionCode {
  //common
  ValidationError = 'ValidationError',
  BadRequest = 'BadRequest',
  Forbidden = 'Forbidden',
  NotFound = 'NotFound',
  InternalServerError = 'InternalServerError',
  //auth
  Unauthorized = 'Unauthorized',
  EmailNotConfirmed = 'EmailNotConfirmed',
  ConfirmationCodeExpired = 'ConfirmationCodeExpired',
  PasswordRecoveryCodeExpired = 'PasswordRecoveryCodeExpired',
}
