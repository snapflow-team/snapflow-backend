import { ClientProxy, ReadPacket } from '@nestjs/microservices';
import { firstValueFrom, throwError, timer } from 'rxjs';
import { catchError, retry, timeout } from 'rxjs/operators';
import { IRpcErrorResponse } from './rpc-exception-response';
import { isRpcErrorResponse } from './is-rpc-error-response';

export interface IRpcExceptionMapper {
  mapRpcToDomainException(error: IRpcErrorResponse<unknown>): Error;
}

export interface IRpcCallerOptions {
  timeoutMs?: number;
  retryCount?: number;
  retryDelayMs?: number;
  serviceName?: string;
}

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_RETRY_COUNT = 0;
const DEFAULT_RETRY_DELAY_MS = 100;

export class RpcCaller {
  constructor(private readonly exceptionMapper: IRpcExceptionMapper) {}

  async send<TResponse, TPayload = unknown>(
    client: ClientProxy,
    pattern: ReadPacket['pattern'],
    payload: TPayload,
    options: IRpcCallerOptions = {},
  ): Promise<TResponse> {
    const {
      timeoutMs = DEFAULT_TIMEOUT_MS,
      retryCount = DEFAULT_RETRY_COUNT,
      retryDelayMs = DEFAULT_RETRY_DELAY_MS,
      serviceName,
    } = options;

    try {
      return await firstValueFrom(
        client.send<TResponse, TPayload>(pattern, payload).pipe(
          timeout(timeoutMs),
          retry({
            count: retryCount,
            delay: (error) => {
              if (isRpcErrorResponse(error, serviceName)) {
                throw error;
              }

              return timer(retryDelayMs);
            },
          }),
          catchError((error: unknown) => throwError(() => error)),
        ),
      );
    } catch (error) {
      if (isRpcErrorResponse(error, serviceName)) {
        throw this.exceptionMapper.mapRpcToDomainException(error);
      }

      throw error;
    }
  }
}
