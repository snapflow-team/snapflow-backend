import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { IRpcErrorResponse, rpcServerErrorResponseFactory } from '../rpc-exception-response';
import { TcpContext } from '@nestjs/microservices';
import { Observable, throwError } from 'rxjs';
import { cleanStackTrace } from '../../core/utils/clean-stack-trace';

interface RpcEnvironmentSettings {
  readonly isDevelopment: boolean;
  readonly isProduction: boolean;
}

@Catch()
export class GlobalRpcExceptionFilter implements ExceptionFilter {
  private readonly logger: Logger = new Logger(GlobalRpcExceptionFilter.name);

  constructor(
    private readonly serviceName: string,
    private readonly environmentSettings: RpcEnvironmentSettings,
  ) {}

  catch(exception: Error, host: ArgumentsHost): Observable<any> | any {
    const ctx: TcpContext = host.switchToRpc().getContext<TcpContext>();
    const pattern: string = ctx.getPattern();

    let message: string = 'Some error occurred';

    if (this.environmentSettings.isDevelopment) {
      message = exception.message ?? 'Unknown exception occurred';
    }

    const responseBody: IRpcErrorResponse<string> = rpcServerErrorResponseFactory(
      this.serviceName,
      this.environmentSettings.isDevelopment ? pattern : null,
      message,
    );

    this.logException(exception, pattern);

    return throwError(() => responseBody);
  }

  private logException(exception: any, pattern: string | any): void {
    const message = exception?.message || 'Unknown error';

    let cleanStack: string;

    if (this.environmentSettings.isProduction) {
      cleanStack = exception?.stack;
    } else {
      cleanStack = cleanStackTrace(exception?.stack);
    }

    this.logger.error(`[RPC Pattern: ${pattern}] ${message}`, cleanStack);
  }
}
