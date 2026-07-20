import { Module } from '@nestjs/common';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { ChatMembershipGuard } from './api/guards/chat-membership.guard';
import { MessagingController } from './api/messaging.controller';
import { PresenceBroadcastHelper } from './application/helpers/presence-broadcast.helper';
import { GetChatMessagesQueryHandler } from './application/queries/get-chat-messages.query-handler';
import { GetPresenceQueryHandler } from './application/queries/get-presence.query-handler';
import { GetUserChatsQueryHandler } from './application/queries/get-user-chats.query-handler';
import { GetOrCreateChatUseCase } from './application/usecases/get-or-create-chat.usecase';
import { DeleteMessageUseCase } from './application/usecases/delete-message.usecase';
import { EditMessageUseCase } from './application/usecases/edit-message.usecase';
import { MarkChatReadUseCase } from './application/usecases/mark-chat-read.usecase';
import { MarkMessageDeliveredUseCase } from './application/usecases/mark-message-delivered.usecase';
import { PresenceConnectUseCase } from './application/usecases/presence-connect.usecase';
import { PresenceDisconnectUseCase } from './application/usecases/presence-disconnect.usecase';
import { PresenceHeartbeatUseCase } from './application/usecases/presence-heartbeat.usecase';
import { SendMessageUseCase } from './application/usecases/send-message.usecase';
import { TypingStartUseCase } from './application/usecases/typing-start.usecase';
import { TypingStopUseCase } from './application/usecases/typing-stop.usecase';
import { UpdateActivityStatusUseCase } from './application/usecases/update-activity-status.usecase';
import { ChatsQueryRepository } from './infrastructure/query/chats.query-repository';
import { MessagesQueryRepository } from './infrastructure/query/messages.query-repository';
import { ChatsRepository } from './infrastructure/chats.repository';
import { MessagesRepository } from './infrastructure/messages.repository';
import { PresenceRedisRepository } from './infrastructure/presence-redis.repository';
import { PresenceRepository } from './infrastructure/presence.repository';
import { MessengerWebSocketGateway } from './websocket/gateway/messenger-websocket.gateway';
import { MessengerWebSocketService } from './websocket/services/messenger-websocket.service';

const useCases = [
  SendMessageUseCase,
  GetOrCreateChatUseCase,
  MarkChatReadUseCase,
  MarkMessageDeliveredUseCase,
  TypingStartUseCase,
  TypingStopUseCase,
  EditMessageUseCase,
  DeleteMessageUseCase,
  PresenceConnectUseCase,
  PresenceDisconnectUseCase,
  PresenceHeartbeatUseCase,
  UpdateActivityStatusUseCase,
];
const queries = [GetUserChatsQueryHandler, GetChatMessagesQueryHandler, GetPresenceQueryHandler];
const repositories = [
  ChatsRepository,
  ChatsQueryRepository,
  MessagesRepository,
  MessagesQueryRepository,
  PresenceRedisRepository,
  PresenceRepository,
];
const guards = [AccessTokenGuard, ChatMembershipGuard];
const websocketProviders = [MessengerWebSocketGateway, MessengerWebSocketService];
const presenceHelpers = [PresenceBroadcastHelper];

@Module({
  controllers: [MessagingController],
  providers: [
    ...useCases,
    ...queries,
    ...repositories,
    ...guards,
    ...websocketProviders,
    ...presenceHelpers,
  ],
})
export class MessagingModule {}
