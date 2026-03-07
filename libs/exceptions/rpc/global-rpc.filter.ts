import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Observable, throwError } from 'rxjs';
import { createRpcInternalError } from './rpc-error.factory';

const logger = new Logger('RpcGlobalFilter');

@Catch()
export class GlobalRpcExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost): Observable<never> {
    // Уже готовые RpcException НЕ ловим
    if (exception instanceof RpcException) {
      return throwError(() => exception);
    }

    logger.error('Unhandled RPC exception', exception.stack);

    return throwError(() => new RpcException(createRpcInternalError()));
  }
}
