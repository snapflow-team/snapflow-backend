import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ValidationException } from '../../core';
import { TcpContext } from '@nestjs/microservices';
import { rpcErrorResponseFactory } from '../rpc-exception-response';

@Catch(ValidationException)
export class ValidationRpcExceptionFilter implements ExceptionFilter {
  constructor(private readonly serviceName: string) {}

  catch(exception: ValidationException, host: ArgumentsHost): Observable<any> | any {
    const ctx: TcpContext = host.switchToRpc().getContext<TcpContext>();
    const pattern: string = ctx.getPattern();

    return rpcErrorResponseFactory(exception, this.serviceName, pattern);
  }
}
