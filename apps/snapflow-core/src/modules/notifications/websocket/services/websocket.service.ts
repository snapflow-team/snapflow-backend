import { NotificationGateway } from '../notification-websocket.gateway';
import { Injectable } from '@nestjs/common';

@Injectable()
export class WebsocketService {
  constructor(private readonly gateway: NotificationGateway) {}

  sendToUser(userId: string, payload: any) {
    this.gateway.server.to(`user:${userId}`).emit('notification', payload);
    console.log('Payload sent via websocket');
  }
}
