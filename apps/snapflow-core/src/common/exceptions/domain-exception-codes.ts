import { CommonDomainExceptionCode } from '../../../../../libs/exceptions/core';

export const SnapFlowDomainExceptionCode = {
  ...CommonDomainExceptionCode,
} as const;

export type SnapFlowDomainExceptionCodeType =
  (typeof SnapFlowDomainExceptionCode)[keyof typeof SnapFlowDomainExceptionCode];
