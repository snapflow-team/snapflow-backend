import { HttpStatus, Injectable } from '@nestjs/common';
import {
  BaseDomainExceptionsCodeMapper,
  ValidationException,
} from '../../../../../libs/exceptions/core';
import { SnapFlowDomainExceptionCodeType } from './domain-exception-codes';
import { IRpcErrorResponse } from '../../../../../libs/exceptions/rpc/rpc-exception-response';
import {
  BadRequestException,
  InternalServerException,
  NotFoundException,
} from './domain-exceptions';

@Injectable()
export class SnapFlowDomainExceptionCodeMapper extends BaseDomainExceptionsCodeMapper {
  mapToHttpStatus(code: SnapFlowDomainExceptionCodeType): HttpStatus {
    switch (code) {
      default:
        return super.mapToHttpStatus(code);
    }
  }

  mapRpcToDomainException = (rpcError: IRpcErrorResponse): Error => {
    switch (rpcError.code) {
      case 'NotFound':
        return new NotFoundException(rpcError.message);
      case 'BadRequest':
        return new BadRequestException(rpcError.message);
      case 'ValidationError':
        return new ValidationException(rpcError.extensions || []);
      default:
        return new InternalServerException(rpcError.message);
    }
  };
}
