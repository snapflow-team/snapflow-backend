import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { rpcErrorResponseFactory } from '../rpc-exception-response';
import { CommonDomainExceptionCodeType, DomainException } from '../../core';
import { TcpContext } from '@nestjs/microservices';

@Catch(DomainException)
export class DomainRpcExceptionsFilter<TCode = CommonDomainExceptionCodeType>
  implements ExceptionFilter<DomainException<TCode>>
{
  constructor(private readonly serviceName: string) {}

  catch(exception: DomainException<TCode>, host: ArgumentsHost): Observable<any> | any {
    const ctx: TcpContext = host.switchToRpc().getContext<TcpContext>();
    const pattern: string = ctx.getPattern();

    return throwError(() => rpcErrorResponseFactory(exception, this.serviceName, pattern));
  }
}
