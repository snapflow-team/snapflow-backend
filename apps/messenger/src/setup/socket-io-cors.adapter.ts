import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { Server, ServerOptions } from 'socket.io';
import { LoggerFactory } from '../modules/logger/logger.factory';
import { ContextLogger } from '../modules/logger/context-logger';

export class SocketIoCorsAdapter extends IoAdapter {
  private adapterConstructor?: ReturnType<typeof createAdapter>;
  private readonly logger: ContextLogger;

  constructor(
    app: INestApplicationContext,
    private readonly origin: string[] | boolean,
  ) {
    super(app);
    this.logger = app.get(LoggerFactory).create(SocketIoCorsAdapter.name);
  }

  async connectToRedis(redisClient: Redis): Promise<void> {
    const subClient: Redis = redisClient.duplicate();

    try {
      await Promise.all([redisClient.connect(), subClient.connect()]);
    } catch (error) {
      this.logger.error(error, this.connectToRedis.name);
      throw error;
    }

    this.adapterConstructor = createAdapter(redisClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server: Server = super.createIOServer(port, {
      ...options,
      cors: {
        ...options?.cors,
        origin: this.origin,
        credentials: true,
      },
    }) as Server;

    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }

    return server;
  }
}
