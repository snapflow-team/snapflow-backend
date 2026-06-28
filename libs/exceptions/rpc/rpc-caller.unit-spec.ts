import { ClientProxy } from '@nestjs/microservices';
import { Observable, NEVER, of, throwError } from 'rxjs';
import { TimeoutError } from 'rxjs';
import { RpcCaller } from './rpc-caller';
import { IRpcErrorResponse } from './rpc-exception-response';

describe('RpcCaller', () => {
  const pattern = { cmd: 'testCommand' };
  const payload = { id: '1' };

  const mapRpcToDomainException = jest.fn((error: IRpcErrorResponse<unknown>) => {
    return new Error(`mapped:${String(error.code)}`);
  });

  const exceptionMapper = { mapRpcToDomainException };
  const sendMock = jest.fn();
  const client = { send: sendMock } as unknown as ClientProxy;
  const rpcCaller = new RpcCaller(exceptionMapper);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('возвращает первое полученное значение при успешном вызове', async () => {
    sendMock.mockReturnValue(of({ ok: true }));

    const result = await rpcCaller.send<{ ok: boolean }>(client, pattern, payload);

    expect(result).toEqual({ ok: true });
    expect(sendMock).toHaveBeenCalledWith(pattern, {
      data: payload,
      meta: { requestId: null },
    });
    expect(mapRpcToDomainException).not.toHaveBeenCalled();
  });

  it('повторяет запрос при временных ошибках и в итоге завершается успешно', async () => {
    let attempt = 0;

    sendMock.mockImplementation(
      () =>
        new Observable<string>((subscriber) => {
          attempt += 1;

          if (attempt < 3) {
            subscriber.error(new Error(`transient:${attempt}`));
            return;
          }

          subscriber.next('ok');
          subscriber.complete();
        }),
    );

    const result = await rpcCaller.send<string>(client, pattern, payload, {
      retryCount: 2,
      retryDelayMs: 0,
    });

    expect(result).toBe('ok');
    expect(attempt).toBe(3);
    expect(mapRpcToDomainException).not.toHaveBeenCalled();
  });

  it('кладёт requestId из getRequestId в meta envelope', async () => {
    const getRequestId = jest.fn(() => 'trace-abc');
    const callerWithRequestId = new RpcCaller(exceptionMapper, getRequestId);
    sendMock.mockReturnValue(of({ ok: true }));

    await callerWithRequestId.send<{ ok: boolean }>(client, pattern, payload);

    expect(getRequestId).toHaveBeenCalled();
    expect(sendMock).toHaveBeenCalledWith(pattern, {
      data: payload,
      meta: { requestId: 'trace-abc' },
    });
  });

  it('не повторяет RPC-ошибки и маппит их через ExceptionMapper', async () => {
    const rpcError: IRpcErrorResponse = {
      timestamp: new Date().toISOString(),
      service: 'FILES_SERVICE',
      pattern: 'testCommand',
      message: 'Bad request',
      code: 'BadRequest',
      extensions: [],
    };

    sendMock.mockReturnValue(throwError(() => rpcError));

    await expect(
      rpcCaller.send(client, pattern, payload, {
        serviceName: 'FILES_SERVICE',
        retryCount: 3,
        retryDelayMs: 0,
      }),
    ).rejects.toThrow('mapped:BadRequest');

    expect(mapRpcToDomainException).toHaveBeenCalledWith(rpcError);
  });

  it('выбрасывает ошибку таймаута, когда ответ превышает лимит ожидания', async () => {
    sendMock.mockReturnValue(NEVER);

    await expect(
      rpcCaller.send(client, pattern, payload, {
        timeoutMs: 1,
      }),
    ).rejects.toBeInstanceOf(TimeoutError);

    expect(mapRpcToDomainException).not.toHaveBeenCalled();
  });

  it('пробрасывает не-RPC ошибки без маппинга', async () => {
    const networkError = new Error('ECONNREFUSED');
    sendMock.mockReturnValue(throwError(() => networkError));

    await expect(rpcCaller.send(client, pattern, payload)).rejects.toThrow('ECONNREFUSED');
    expect(mapRpcToDomainException).not.toHaveBeenCalled();
  });
});
