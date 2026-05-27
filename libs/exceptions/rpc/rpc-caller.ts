import { ClientProxy, ReadPacket } from '@nestjs/microservices';
import { firstValueFrom, throwError, timer } from 'rxjs';
import { catchError, retry, timeout } from 'rxjs/operators';

import { RpcEnvelope } from '../../common/rpc/rpc-envelope';
import { IRpcErrorResponse } from './rpc-exception-response';
import { isRpcErrorResponse } from './is-rpc-error-response';

/**
 * Контракт маппера, который преобразует RPC-ошибку в доменное исключение приложения.
 */
export interface IRpcExceptionMapper {
  mapRpcToDomainException(error: IRpcErrorResponse<unknown>): Error;
}

/**
 * Параметры выполнения RPC-вызова.
 */
export interface IRpcCallerOptions {
  /** Таймаут ожидания ответа в миллисекундах. */
  timeoutMs?: number;
  /** Количество повторных попыток для временных (не RPC) ошибок. */
  retryCount?: number;
  /** Задержка между retry-попытками в миллисекундах. */
  retryDelayMs?: number;
  /** Ожидаемое имя сервиса для точной проверки RPC-ошибки. */
  serviceName?: string;
}

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_RETRY_COUNT = 0;
const DEFAULT_RETRY_DELAY_MS = 100;

/**
 * Универсальная утилита для безопасного вызова NestJS RPC-клиента.
 *
 * Что делает:
 * - конвертирует Observable из `ClientProxy.send` в Promise через `firstValueFrom`;
 * - ограничивает время ожидания ответа через `timeout`;
 * - делает `retry` только для временных/транспортных ошибок;
 * - не ретраит доменные RPC-ошибки;
 * - маппит RPC-ошибки в доменные исключения через `ExceptionMapper`.
 */
export class RpcCaller {
  constructor(
    private readonly exceptionMapper: IRpcExceptionMapper,
    private readonly getRequestId?: () => string | null,
  ) {}

  /**
   * Отправляет RPC-команду и возвращает первое значение ответа.
   *
   * @typeParam TResponse - Тип ожидаемого ответа.
   * @typeParam TPayload - Тип отправляемого payload.
   * @param client - Экземпляр `ClientProxy`.
   * @param pattern - RPC pattern (например, `{ cmd: 'SomeCommand' }`).
   * @param payload - Данные запроса.
   * @param options - Опции timeout/retry и ожидаемого сервиса.
   * @returns Promise с типизированным ответом `TResponse`.
   * @throws Ошибку, полученную после исчерпания retry-попыток или timeout.
   * @throws Доменное исключение из `exceptionMapper`, если ошибка распознана как RPC-ошибка.
   */
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

    const requestId: string | null = this.getRequestId?.() ?? null;
    const enveloped: RpcEnvelope<TPayload> = { data: payload, meta: { requestId } };

    try {
      return await firstValueFrom(
        client.send<TResponse, RpcEnvelope<TPayload>>(pattern, enveloped).pipe(
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
