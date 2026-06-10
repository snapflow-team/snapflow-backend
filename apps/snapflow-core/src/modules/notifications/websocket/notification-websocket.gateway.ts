import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../../../setup/configuration/configuration';
import { LoggerFactory } from '../../logger/logger.factory';
import { ContextLogger } from '../../logger/context-logger';
import { AuthTokenService } from '../../user-accounts/auth/application/services/auth-token.service';
import { PayloadAccessToken } from '../../user-accounts/auth/application/types/payload-access-token.type';
import { SocketDataType } from './types/socket-data.type';

@WebSocketGateway({
  namespace: 'notifications',
  cors: {
    origin: '*',
  },
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;
  private readonly logger: ContextLogger;

  constructor(
    private readonly configService: ConfigService<Configuration, true>,
    loggerFactory: LoggerFactory,
    private jwtService: AuthTokenService,
  ) {
    this.logger = loggerFactory.create(NotificationGateway.name);
  }

  afterInit(server: Server<any, any, any, SocketDataType>) {
    this.logger.log('Websocket gateway successfully started');

    server.use((socket, next) => {
      try {
        console.log(socket.handshake);
        const token = (socket.handshake.auth?.token as string) ?? socket.handshake.headers.token;

        if (!token) {
          const error: Error & { data?: unknown } = new Error('Unauthorized: No token provided');

          return next(error);
        }

        const payload: PayloadAccessToken = this.jwtService.verifyAndDecodeAccessToken(token);

        socket.data.userId = payload.userId;
        socket.data.exp = payload.exp;

        next();
      } catch {
        const error: Error & { data?: unknown } = new Error('Unauthorized: Invalid token');

        this.logger.warn(
          `Socket auth failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );

        next(error);
      }
    });
  }

  async handleConnection(client: Socket<any, any, any, SocketDataType>) {
    this.logger.log(`Client connected ${client.id}`);

    try {
      await client.join(`user:${client.data.userId}`);

      this.setupTokenExpiry(client, client.data.exp);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Some error occurred in authorization';
      this.logger.log(
        `Client disconnected because of unauthorized ${client.id}. Error: ${errorMessage}`,
      );

      client.disconnect();
    }
  }

  handleDisconnect(client: Socket<any, any, any, SocketDataType>) {
    this.logger.log(`Client disconnected ${client.id}`);
    this.clearClientTimer(client);
  }

  private setupTokenExpiry(client: Socket<any, any, any, SocketDataType>, exp: number | undefined) {
    if (!exp) {
      client.disconnect(true);
      return;
    }
    const disconnectAt = Math.max(0, Math.floor(exp * 1000 - Date.now()));

    if (disconnectAt <= 0) {
      client.disconnect(true);
      return;
    }

    const timer = setTimeout(() => {
      client.data.timer = undefined;
      client.emit('token.expired');
      client.disconnect(true);
    }, disconnectAt);

    client.data.timer = timer;
  }

  private clearClientTimer(client: Socket<any, any, any, SocketDataType>) {
    if (client.data.timer) {
      clearTimeout(client.data.timer);
      client.data.timer = undefined;
    }
  }
}
