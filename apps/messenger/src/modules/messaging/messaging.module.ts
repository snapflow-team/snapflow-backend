import { Module } from '@nestjs/common';
import { RemoteAuthGuard } from '../auth/guards/remote-auth.guard';
import { MessagingController } from './api/messaging.controller';
import { SendMessageUseCase } from './application/usecases/send-message.usecase';
import { ChatsRepository } from './infrastructure/chats.repository';
import { MessagesRepository } from './infrastructure/messages.repository';
import { MessengerWebSocketGateway } from './websocket/gateway/messenger-websocket.gateway';
import { MessengerWebSocketService } from './websocket/services/messenger-websocket.service';

const useCases = [SendMessageUseCase];
const repositories = [ChatsRepository, MessagesRepository];
const guards = [RemoteAuthGuard];
const websocketProviders = [MessengerWebSocketGateway, MessengerWebSocketService];

@Module({
  controllers: [MessagingController],
  providers: [...useCases, ...repositories, ...guards, ...websocketProviders],
})
export class MessagingModule {}
