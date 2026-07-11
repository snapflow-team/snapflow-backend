import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';

export class SocketIoCorsAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly origin: string[] | boolean,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): unknown {
    return super.createIOServer(port, {
      ...options,
      cors: {
        ...options?.cors,
        origin: this.origin,
        credentials: true,
      },
    });
  }
}
