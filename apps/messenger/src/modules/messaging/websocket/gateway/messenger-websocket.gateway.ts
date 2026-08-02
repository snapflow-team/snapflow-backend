import { CommandBus } from '@nestjs/cqrs';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { MessageDeliveredPayload, TypingInboundPayload, } from '../../../../../../../libs/contracts/messenger';
import { MessengerWsEvent } from '../../../../../../../libs/contracts/messenger';
import { AuthTokenService } from '../../../auth/application/services/auth-token.service';
import { PayloadAccessToken } from '../../../auth/application/types/payload-access-token.type';
import { LoggerFactory } from '../../../logger/logger.factory';
import { ContextLogger } from '../../../logger/context-logger';
import { MarkMessageDeliveredCommand } from '../../application/commands/mark-message-delivered.command';
import { PresenceConnectCommand } from '../../application/commands/presence-connect.command';
import { PresenceDisconnectCommand } from '../../application/commands/presence-disconnect.command';
import { PresenceHeartbeatCommand } from '../../application/commands/presence-heartbeat.command';
import { TypingStartCommand } from '../../application/commands/typing-start.command';
import { TypingStopCommand } from '../../application/commands/typing-stop.command';
import { SocketDataType } from '../types/socket-data.type';

@WebSocketGateway({
  namespace: 'messenger',
})
export class MessengerWebSocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;
  private readonly logger: ContextLogger;

  constructor(
    private readonly authTokenService: AuthTokenService,
    private readonly commandBus: CommandBus,
    loggerFactory: LoggerFactory,
  ) {
    this.logger = loggerFactory.create(MessengerWebSocketGateway.name);
  }

  @SubscribeMessage(MessengerWsEvent.MessageDelivered)
  async handleMessageDelivered(
    @ConnectedSocket() client: Socket<any, any, any, SocketDataType>,
    @MessageBody() payload: MessageDeliveredPayload,
  ): Promise<void> {
    const userId: number | undefined = client.data.userId;
    if (!userId) {
      return;
    }

    const messageId: number = Number(payload?.messageId);
    if (!Number.isInteger(messageId) || messageId <= 0) {
      this.logger.warn(
        `Ignored invalid message.delivered payload from user:${userId}`,
        this.handleMessageDelivered.name,
      );
      return;
    }

    try {
      await this.commandBus.execute(
        new MarkMessageDeliveredCommand({
          messageId,
          deliveredByUserId: userId,
        }),
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `message.delivered failed for user:${userId}, messageId=${messageId}: ${errorMessage}`,
        this.handleMessageDelivered.name,
      );
    }
  }

  @SubscribeMessage(MessengerWsEvent.TypingStart)
  async handleTypingStart(
    @ConnectedSocket() client: Socket<any, any, any, SocketDataType>,
    @MessageBody() payload: TypingInboundPayload,
  ): Promise<void> {
    await this.handleTypingEvent(client, payload, MessengerWsEvent.TypingStart);
  }

  @SubscribeMessage(MessengerWsEvent.TypingStop)
  async handleTypingStop(
    @ConnectedSocket() client: Socket<any, any, any, SocketDataType>,
    @MessageBody() payload: TypingInboundPayload,
  ): Promise<void> {
    await this.handleTypingEvent(client, payload, MessengerWsEvent.TypingStop);
  }

  @SubscribeMessage(MessengerWsEvent.PresenceHeartbeat)
  async handlePresenceHeartbeat(
    @ConnectedSocket() client: Socket<any, any, any, SocketDataType>,
  ): Promise<void> {
    const userId: number | undefined = client.data.userId;
    if (!userId) {
      return;
    }

    try {
      await this.commandBus.execute(new PresenceHeartbeatCommand({ userId, socketId: client.id }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `presence.heartbeat failed for user:${userId}: ${errorMessage}`,
        this.handlePresenceHeartbeat.name,
      );
    }
  }

  afterInit(server: Server<any, any, any, SocketDataType>) {
    this.logger.log('Messenger websocket gateway successfully started');

    server.use((socket, next) => {
      void this.authorizeSocket(socket, next);
    });
  }

  async handleConnection(client: Socket<any, any, any, SocketDataType>) {
    this.logger.log(`Client connected ${client.id}`);

    try {
      const userId: number | undefined = client.data.userId;
      await client.join(`user:${userId}`);

      this.setupTokenExpiry(client, client.data.exp);

      if (userId) {
        try {
          await this.commandBus.execute(new PresenceConnectCommand({ userId, socketId: client.id }));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn(
            `presence.connect failed for user:${userId}: ${errorMessage}`,
            this.handleConnection.name,
          );
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Some error occurred in authorization';
      this.logger.log(
        `Client disconnected because of unauthorized ${client.id}. Error: ${errorMessage}`,
      );

      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket<any, any, any, SocketDataType>) {
    this.logger.log(`Client disconnected ${client.id}`);
    this.clearClientTimer(client);

    const userId: number | undefined = client.data.userId;
    if (!userId) {
      return;
    }

    try {
      await this.commandBus.execute(new PresenceDisconnectCommand({ userId, socketId: client.id }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `presence.disconnect failed for user:${userId}: ${errorMessage}`,
        this.handleDisconnect.name,
      );
    }
  }

  private async authorizeSocket(
    socket: Socket<any, any, any, SocketDataType>,
    next: (err?: Error) => void,
  ): Promise<void> {
    try {
      const rawToken: string | undefined = this.extractToken(socket);
      if (!rawToken) {
        return next(new Error('Unauthorized: No token provided'));
      }

      const token: string | null = this.normalizeAccessToken(rawToken);
      if (!token) {
        return next(new Error('Unauthorized: Invalid token'));
      }

      const payload: PayloadAccessToken = this.authTokenService.verifyAndDecodeAccessToken(token);

      if (!Number.isInteger(payload.userId) || payload.userId <= 0) {
        throw new Error('Invalid user id from token');
      }

      socket.data.userId = payload.userId;
      socket.data.exp = payload.exp;
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

  private normalizeAccessToken(token: string): string | null {
    const trimmedToken: string = token.trim();
    if (trimmedToken === '') {
      return null;
    }

    const match = trimmedToken.match(/^Bearer\s+(\S+)$/i);

    return match?.[1] ?? trimmedToken;
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

  private async handleTypingEvent(
    client: Socket<any, any, any, SocketDataType>,
    payload: TypingInboundPayload,
    event: MessengerWsEvent.TypingStart | MessengerWsEvent.TypingStop,
  ): Promise<void> {
    const userId: number | undefined = client.data.userId;
    if (!userId) {
      return;
    }

    const chatId: number = Number(payload?.chatId);
    if (!Number.isInteger(chatId) || chatId <= 0) {
      this.logger.warn(
        `Ignored invalid ${event} payload from user:${userId}`,
        this.handleTypingEvent.name,
      );
      return;
    }

    try {
      if (event === MessengerWsEvent.TypingStart) {
        await this.commandBus.execute(new TypingStartCommand({ chatId, userId }));
      } else {
        await this.commandBus.execute(new TypingStopCommand({ chatId, userId }));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `${event} failed for user:${userId}, chatId=${chatId}: ${errorMessage}`,
        this.handleTypingEvent.name,
      );
    }
  }
}
