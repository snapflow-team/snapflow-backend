export const CommonDomainExceptionCode = {
  ValidationError: 'ValidationError',
  BadRequest: 'BadRequest',
  Forbidden: 'Forbidden',
  NotFound: 'NotFound',
  InternalServerError: 'InternalServerError',
  Unauthorized: 'Unauthorized',
} as const;

export type CommonDomainExceptionCodeType =
  (typeof CommonDomainExceptionCode)[keyof typeof CommonDomainExceptionCode];
