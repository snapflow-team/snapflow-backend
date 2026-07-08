import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { Server, Socket } from 'socket.io';
import { LoggerFactory } from '../../../logger/logger.factory';
import { ContextLogger } from '../../../logger/context-logger';
import { Configuration } from '../../../../setup/configuration/configuration';
import { ApiSettings } from '../../../../setup/configuration/api-settings';
import { SocketDataType } from '../types/socket-data.type';

@WebSocketGateway({
  namespace: 'messenger',
  cors: {
    origin: '*',
  },
})
export class MessengerWebSocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;
  private readonly logger: ContextLogger;
  private readonly coreUrl: string;

  constructor(
    private readonly configService: ConfigService<Configuration, true>,
    private readonly httpService: HttpService,
    loggerFactory: LoggerFactory,
  ) {
    this.coreUrl = this.configService.get<ApiSettings>('apiSettings').coreServiceUrl;
    this.logger = loggerFactory.create(MessengerWebSocketGateway.name);
  }

  afterInit(server: Server<any, any, any, SocketDataType>) {
    this.logger.log('Messenger websocket gateway successfully started');

    server.use((socket, next) => {
      // vilyamz[messenger]: выяснить как правильно выстраить авторизацию в этом сервисе
      void this.authorizeSocket(socket, next);
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

  private async authorizeSocket(
    socket: Socket<any, any, any, SocketDataType>,
    next: (err?: Error) => void,
  ): Promise<void> {
    try {
      const token: string | undefined = this.extractToken(socket);
      if (!token) {
        return next(new Error('Unauthorized: No token provided'));
      }

      const bearerToken: string = token.toLowerCase().startsWith('bearer ')
        ? token
        : `Bearer ${token}`;

      const response = await lastValueFrom(
        this.httpService.get<{ userId: string }>(`${this.coreUrl}/api/v1/auth/me`, {
          headers: {
            Authorization: bearerToken,
          },
        }),
      );

      const userId: number = Number(response.data.userId);
      if (!Number.isInteger(userId) || userId <= 0) {
        throw new Error('Invalid user id from auth service');
      }

      socket.data.userId = userId;
      socket.data.exp = this.extractTokenExp(token);
      next();
    } catch (error) {
      const message: string = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Socket auth failed: ${message}`);
      next(new Error('Unauthorized: Invalid token'));
    }
  }

  private extractToken(socket: Socket<any, any, any, SocketDataType>): string | undefined {
    const authToken: unknown = socket.handshake.auth?.token;
    const headerToken: string | string[] | undefined = socket.handshake.headers.token;
    const token: string | undefined =
      typeof authToken === 'string'
        ? authToken
        : typeof headerToken === 'string'
          ? headerToken
          : Array.isArray(headerToken)
            ? headerToken[0]
            : undefined;

    if (!token) {
      return undefined;
    }

    const trimmedToken: string = token.trim();
    return trimmedToken === '' ? undefined : trimmedToken;
  }

  private extractTokenExp(token: string): number | undefined {
    try {
      const tokenWithoutBearer = token.toLowerCase().startsWith('bearer ')
        ? token.slice('Bearer '.length)
        : token;
      const payloadPart = tokenWithoutBearer.split('.')[1];
      if (!payloadPart) {
        return undefined;
      }

      const normalizedPayloadPart = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
      const paddedPayloadPart = normalizedPayloadPart.padEnd(
        normalizedPayloadPart.length + ((4 - (normalizedPayloadPart.length % 4)) % 4),
        '=',
      );
      const payloadJson = Buffer.from(paddedPayloadPart, 'base64').toString('utf8');
      const payload: { exp?: unknown } = JSON.parse(payloadJson) as { exp?: unknown };

      return typeof payload.exp === 'number' ? payload.exp : undefined;
    } catch {
      return undefined;
    }
  }

  private setupTokenExpiry(client: Socket<any, any, any, SocketDataType>, exp: number | undefined) {
    if (!exp) {
      client.disconnect(true);
      return;
    }
    const disconnectAt: number = Math.max(0, Math.floor(exp * 1000 - Date.now()));

    if (disconnectAt <= 0) {
      client.disconnect(true);
      return;
    }

    client.data.timer = setTimeout(() => {
      client.data.timer = undefined;
      client.emit('token.expired');
      client.disconnect(true);
    }, disconnectAt);
  }

  private clearClientTimer(client: Socket<any, any, any, SocketDataType>) {
    if (client.data.timer) {
      clearTimeout(client.data.timer);
      client.data.timer = undefined;
    }
  }
}
