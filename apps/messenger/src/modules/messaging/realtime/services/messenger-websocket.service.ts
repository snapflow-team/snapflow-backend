import { Injectable } from '@nestjs/common';
import { MessengerWsEvent, NewMessagePayload } from '@contracts/messenger';
import { LoggerFactory } from '../../../logger/logger.factory';
import { ContextLogger } from '../../../logger/context-logger';
import { MessengerWebSocketGateway } from '../gateway/messenger-websocket.gateway';

@Injectable()
export class MessengerWebSocketService {
  private readonly logger: ContextLogger;

  constructor(
    private readonly gateway: MessengerWebSocketGateway,
    loggerFactory: LoggerFactory,
  ) {
    this.logger = loggerFactory.create(MessengerWebSocketService.name);
  }

  emitToUser(userId: number, event: MessengerWsEvent, payload: unknown): void {
    this.gateway.server.to(`user:${userId}`).emit(event, payload);
    this.logger.log(`Event ${event} emitted via WebSocket to user:${userId}`, this.emitToUser.name);
  }

  sendToUser(userId: number, payload: NewMessagePayload): void {
    this.emitToUser(userId, MessengerWsEvent.MessageNew, payload);
    this.logger.log(
      `Message sent via WebSocket to user:${userId}, messageId=${payload.id}`,
      this.sendToUser.name,
    );
  }
}
