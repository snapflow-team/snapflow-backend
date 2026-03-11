import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { IRpcErrorResponse, rpcServerErrorResponseFactory } from '../rpc-exception-response';
import { TcpContext } from '@nestjs/microservices';
import { Observable } from 'rxjs';

@Catch()
export class GlobalRpcExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly serviceName: string,
    private readonly isExposeDetails: boolean = false,
  ) {}

  catch(exception: Error, host: ArgumentsHost): Observable<any> | any {
    const ctx: TcpContext = host.switchToRpc().getContext<TcpContext>();
    const pattern: string = ctx.getPattern();

    let message: string = 'Some error occurred';

    if (this.isExposeDetails) {
      message = exception.message ?? 'Unknown exception occurred';
    }

    const responseBody: IRpcErrorResponse<string> = rpcServerErrorResponseFactory(
      this.serviceName,
      this.isExposeDetails ? pattern : null,
      message,
    );

    this.logException(exception, pattern);

    return responseBody;
  }

  private logException(exception: unknown, pattern: string | any): void {
    const logPayload = {
      level: 'error',
      timestamp: new Date().toISOString(),
      type: exception?.constructor?.name,
      message: (exception as any)?.message,
      rpc: {
        pattern,
      },
    };

    console.error({
      ...logPayload,
      stack: (exception as any)?.stack,
    });
  }
}
