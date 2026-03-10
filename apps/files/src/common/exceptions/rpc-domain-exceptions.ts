import { DomainException } from '../../../../../libs/exceptions/core';
import {
  SnapFlowRpcDomainExceptionCode,
  SnapFlowRpcDomainExceptionCodeType,
} from './rpc-domain-exception-codes';

export class RpcBadRequestException extends DomainException<SnapFlowRpcDomainExceptionCodeType> {
  constructor(message: string = 'Bad Request') {
    super({
      code: SnapFlowRpcDomainExceptionCode.BadRequest,
      message,
    });
  }
}

export class RpcNotFoundException extends DomainException<SnapFlowRpcDomainExceptionCodeType> {
  constructor(message: string = 'Not Found') {
    super({
      code: SnapFlowRpcDomainExceptionCode.NotFound,
      message,
    });
  }
}
