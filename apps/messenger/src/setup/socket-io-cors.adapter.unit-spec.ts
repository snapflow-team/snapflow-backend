import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { Server } from 'socket.io';
import { SocketIoCorsAdapter } from './socket-io-cors.adapter';

jest.mock('@socket.io/redis-adapter', () => ({
  createAdapter: jest.fn(),
}));

describe('SocketIoCorsAdapter (unit)', () => {
  let mockPubClient: jest.Mocked<Pick<Redis, 'connect' | 'duplicate' | 'status'>>;
  let mockSubClient: jest.Mocked<Pick<Redis, 'connect' | 'status'>>;
  let mockApp: INestApplicationContext;
  let adapter: SocketIoCorsAdapter;
  let adapterConstructor: ReturnType<typeof createAdapter>;

  beforeEach(() => {
    adapterConstructor = jest.fn() as unknown as ReturnType<typeof createAdapter>;
    (createAdapter as jest.Mock).mockReturnValue(adapterConstructor);

    mockSubClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      status: 'ready',
    };

    mockPubClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      duplicate: jest.fn().mockReturnValue(mockSubClient),
      status: 'ready',
    };

    mockApp = {
      get: jest.fn().mockReturnValue({
        create: jest.fn().mockReturnValue({
          trace: jest.fn(),
          error: jest.fn(),
          log: jest.fn(),
        }),
      }),
    } as unknown as INestApplicationContext;

    adapter = new SocketIoCorsAdapter(mockApp, true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('connectToRedis подключает pub/sub клиенты и создаёт Redis-adapter', async () => {
    await adapter.connectToRedis(mockPubClient as unknown as Redis);

    expect(mockPubClient.connect).toHaveBeenCalledTimes(1);
    expect(mockPubClient.duplicate).toHaveBeenCalledTimes(1);
    expect(mockSubClient.connect).toHaveBeenCalledTimes(1);
    expect(createAdapter).toHaveBeenCalledWith(mockPubClient, mockSubClient);
  });

  it('createIOServer подключает Redis-adapter после connectToRedis', async () => {
    const serverAdapter = jest.fn();
    const mockServer = { adapter: serverAdapter } as unknown as Server;

    jest.spyOn(IoAdapter.prototype, 'createIOServer').mockReturnValue(mockServer);

    await adapter.connectToRedis(mockPubClient as unknown as Redis);
    adapter.createIOServer(0);

    expect(serverAdapter).toHaveBeenCalledWith(adapterConstructor);
  });

  it('createIOServer не вызывает adapter без connectToRedis', () => {
    const serverAdapter = jest.fn();
    const mockServer = { adapter: serverAdapter } as unknown as Server;

    jest.spyOn(IoAdapter.prototype, 'createIOServer').mockReturnValue(mockServer);

    adapter.createIOServer(0);

    expect(serverAdapter).not.toHaveBeenCalled();
  });
});
