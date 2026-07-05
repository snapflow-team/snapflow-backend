import { Module } from '@nestjs/common';
import { RemoteAuthGuard } from '../auth/guards/remote-auth.guard';
import { MessagingController } from './api/messaging.controller';
import { SendMessageUseCase } from './application/usecases/send-message.usecase';
import { ChatsRepository } from './infrastructure/chats.repository';
import { MessagesRepository } from './infrastructure/messages.repository';

const useCases = [SendMessageUseCase];
const repositories = [ChatsRepository, MessagesRepository];
const guards = [RemoteAuthGuard];

@Module({
  controllers: [MessagingController],
  providers: [...useCases, ...repositories, ...guards],
})
export class MessagingModule {}
