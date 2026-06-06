import { NotificationGateway } from '../notification-websocket.gateway';
import { Injectable } from '@nestjs/common';
import { LoggerFactory } from '../../../logger/logger.factory';
import { ContextLogger } from '../../../logger/context-logger';

@Injectable()
export class WebsocketService {
  private readonly logger: ContextLogger;

  constructor(
    private readonly gateway: NotificationGateway,
    loggerFactory: LoggerFactory,
  ) {
    this.logger = loggerFactory.create(WebsocketService.name);
  }

  sendToUser(userId: string, payload: any) {
    this.gateway.server.to(`user:${userId}`).emit('notification', payload);
    this.logger.log(
      `Notification sent via WebSocket to user:${userId}, type=${payload?.type ?? 'unknown'}`,
      this.sendToUser.name,
    );
  }
}
