import { Module } from '@nestjs/common';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { ChatMembershipGuard } from './api/guards/chat-membership.guard';
import { MessagingController } from './api/messaging.controller';
import { GetChatMessagesQueryHandler } from './application/queries/get-chat-messages.query-handler';
import { GetUserChatsQueryHandler } from './application/queries/get-user-chats.query-handler';
import { GetOrCreateChatUseCase } from './application/usecases/get-or-create-chat.usecase';
import { MarkChatReadUseCase } from './application/usecases/mark-chat-read.usecase';
import { MarkMessageDeliveredUseCase } from './application/usecases/mark-message-delivered.usecase';
import { SendMessageUseCase } from './application/usecases/send-message.usecase';
import { TypingStartUseCase } from './application/usecases/typing-start.usecase';
import { TypingStopUseCase } from './application/usecases/typing-stop.usecase';
import { ChatsQueryRepository } from './infrastructure/query/chats.query-repository';
import { MessagesQueryRepository } from './infrastructure/query/messages.query-repository';
import { ChatsRepository } from './infrastructure/chats.repository';
import { MessagesRepository } from './infrastructure/messages.repository';
import { MessengerWebSocketGateway } from './websocket/gateway/messenger-websocket.gateway';
import { MessengerWebSocketService } from './websocket/services/messenger-websocket.service';

const useCases = [
  SendMessageUseCase,
  GetOrCreateChatUseCase,
  MarkChatReadUseCase,
  MarkMessageDeliveredUseCase,
  TypingStartUseCase,
  TypingStopUseCase,
];
const queries = [GetUserChatsQueryHandler, GetChatMessagesQueryHandler];
const repositories = [
  ChatsRepository,
  ChatsQueryRepository,
  MessagesRepository,
  MessagesQueryRepository,
];
const guards = [AccessTokenGuard, ChatMembershipGuard];
const websocketProviders = [MessengerWebSocketGateway, MessengerWebSocketService];

@Module({
  controllers: [MessagingController],
  providers: [...useCases, ...queries, ...repositories, ...guards, ...websocketProviders],
})
export class MessagingModule {}
