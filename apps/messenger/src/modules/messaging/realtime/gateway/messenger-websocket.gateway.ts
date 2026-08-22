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
import type { MessageDeliveredPayload, TypingInboundPayload, } from '@contracts/messenger';
import { MessengerWsEvent } from '@contracts/messenger';
import { LoggerFactory } from '../../../logger/logger.factory';
import { ContextLogger } from '../../../logger/context-logger';
import { MarkMessageDeliveredCommand } from '../../application/commands/mark-message-delivered.command';
import { PresenceConnectCommand } from '../../presence/application/commands/presence-connect.command';
import { PresenceDisconnectCommand } from '../../presence/application/commands/presence-disconnect.command';
import { PresenceHeartbeatCommand } from '../../presence/application/commands/presence-heartbeat.command';
import { TypingStartCommand } from '../../presence/application/commands/typing-start.command';
import { TypingStopCommand } from '../../presence/application/commands/typing-stop.command';
import { SocketAuthService } from '../services/socket-auth.service';
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
    private readonly socketAuthService: SocketAuthService,
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
      void this.socketAuthService.authorizeSocket(socket, next);
    });
  }

  async handleConnection(client: Socket<any, any, any, SocketDataType>) {
    this.logger.log(`Client connected ${client.id}`);

    try {
      const userId: number | undefined = client.data.userId;
      await client.join(`user:${userId}`);

      this.socketAuthService.setupTokenExpiry(client, client.data.exp);

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
    this.socketAuthService.clearClientTimer(client);

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
