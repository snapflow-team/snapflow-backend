import { IRpcErrorResponse } from '../../../../../../libs/exceptions/rpc/rpc-exception-response';
import { BadRequestException, InternalServerException, NotFoundException, } from '../domain-exceptions';
import { ValidationException } from '../../../../../../libs/exceptions/core';

const mapRpcToHttpError = (rpcError: IRpcErrorResponse): Error => {
  switch (rpcError.code) {
    case 'NotFound':
      return new NotFoundException(rpcError.message);
    case 'BadRequest':
      return new BadRequestException(rpcError.message);
    case 'ValidationError':
      return new ValidationException(rpcError.extensions);
    default:
      return new InternalServerException(rpcError.message);
  }
};
