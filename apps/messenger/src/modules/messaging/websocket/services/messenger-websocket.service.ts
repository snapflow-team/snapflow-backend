import { Injectable } from '@nestjs/common';
import { MessengerWsEvent } from '../../../../../../../libs/contracts/messenger';
import { LoggerFactory } from '../../../logger/logger.factory';
import { ContextLogger } from '../../../logger/context-logger';
import { MessageViewDto } from '../../api/view-dto/message.view-dto';
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

  sendToUser(userId: number, payload: MessageViewDto) {
    this.gateway.server
      .to(`user:${userId}`)
      .emit(MessengerWsEvent.MessageNew, payload);
    this.logger.log(
      `Message sent via WebSocket to user:${userId}, messageId=${payload.id}`,
      this.sendToUser.name,
    );
  }
}
