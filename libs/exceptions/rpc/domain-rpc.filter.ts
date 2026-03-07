import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Observable, throwError } from 'rxjs';
import { createRpcDomainError } from './rpc-error.factory';
import { RpcExceptionCode } from './rpc-exteption-codes';

@Catch() // ← Ловим ВСЁ, а внутри проверяем instanceof
export class RpcDomainExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): Observable<never> {
    let code = RpcExceptionCode.InternalError;
    let message = 'Internal server error';

    // Проверяем тип исключения
    if (exception instanceof BadRequestException) {
      code = RpcExceptionCode.BadRequest;
      message = exception.message;
    } else if (exception instanceof Error) {
      code = RpcExceptionCode.InternalError;
      message = exception.message;
    }

    const rpcError = createRpcDomainError(code, message);
    return throwError(() => new RpcException(rpcError));
  }
}
