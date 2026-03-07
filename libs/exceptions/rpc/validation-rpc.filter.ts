import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { createRpcValidationError } from './rpc-error.factory';
import { RpcException } from '@nestjs/microservices';

@Catch()
export class RpcValidationPipeFilter implements ExceptionFilter {
  /**
   * Ловит HttpException от ValidationPipe и превращает в RpcErrorDto
   */
  catch(exception: unknown, host: ArgumentsHost): Observable<never> {
    // ValidationPipe кидает BadRequestException с ValidationError[]
    const badRequestException = exception as any;
    if (badRequestException?.response?.message instanceof Array) {
      const validationErrors = badRequestException.response.message;
      const rpcError = createRpcValidationError(validationErrors);
      return throwError(() => new RpcException(rpcError));
    }

    // Не валидация — пропускаем дальше
    return throwError(() => exception as any);
  }
}
