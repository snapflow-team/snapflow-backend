import { Module } from '@nestjs/common';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { OutboxModule } from '../outbox/outbox.module';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';
import { ChatSettingsController } from './chat-settings/api/chat-settings.controller';
import { ChatsController } from './chats/api/chats.controller';
import { MessagesController } from './messages/api/messages.controller';
import { PresenceController } from './presence/api/presence.controller';
import { ReadStateController } from './read-state/api/read-state.controller';
import { ChatMembershipGuard } from './sharing/api/guards/chat-membership.guard';
import { GetChatMessagesQueryHandler } from './application/queries/get-chat-messages.query-handler';
import { GetUnreadTotalQueryHandler } from './application/queries/get-unread-total.query-handler';
import { GetUserChatsQueryHandler } from './application/queries/get-user-chats.query-handler';
import { NewMessageNotificationDispatcherService } from './notifications/application/services/new-message-notification-dispatcher.service';
import { NewMessageNotificationPolicy } from './notifications/application/services/new-message-notification.policy';
import { GetOrCreateChatUseCase } from './application/usecases/get-or-create-chat.usecase';
import { DeleteMessageUseCase } from './application/usecases/delete-message.usecase';
import { EditMessageUseCase } from './application/usecases/edit-message.usecase';
import { MarkChatReadUseCase } from './application/usecases/mark-chat-read.usecase';
import { MarkMessageDeliveredUseCase } from './application/usecases/mark-message-delivered.usecase';
import { MuteChatUseCase } from './application/usecases/mute-chat.usecase';
import { SendMessageUseCase } from './application/usecases/send-message.usecase';
import { UnmuteChatUseCase } from './application/usecases/unmute-chat.usecase';
import { ChatMuteRepository } from './infrastructure/chat-mute.repository';
import { ChatsQueryRepository } from './infrastructure/query/chats.query-repository';
import { MessagesQueryRepository } from './infrastructure/query/messages.query-repository';
import { ChatsRepository } from './infrastructure/chats.repository';
import { MessagesRepository } from './infrastructure/messages.repository';
import { PresenceBroadcastHelper } from './presence/application/helpers/presence-broadcast.helper';
import { GetPresenceQueryHandler } from './presence/application/queries/get-presence.query-handler';
import { PresenceConnectUseCase } from './presence/application/usecases/presence-connect.usecase';
import { PresenceDisconnectUseCase } from './presence/application/usecases/presence-disconnect.usecase';
import { PresenceHeartbeatUseCase } from './presence/application/usecases/presence-heartbeat.usecase';
import { TypingStartUseCase } from './presence/application/usecases/typing-start.usecase';
import { TypingStopUseCase } from './presence/application/usecases/typing-stop.usecase';
import { UpdateActivityStatusUseCase } from './presence/application/usecases/update-activity-status.usecase';
import { PresenceRedisRepository } from './presence/infrastructure/presence-redis.repository';
import { PresenceRepository } from './presence/infrastructure/presence.repository';
import { MessengerWebSocketGateway } from './realtime/gateway/messenger-websocket.gateway';
import { MessengerWebSocketService } from './realtime/services/messenger-websocket.service';
import { SocketAuthService } from './realtime/services/socket-auth.service';

const useCases = [
  SendMessageUseCase,
  GetOrCreateChatUseCase,
  MarkChatReadUseCase,
  MarkMessageDeliveredUseCase,
  MuteChatUseCase,
  UnmuteChatUseCase,
  TypingStartUseCase,
  TypingStopUseCase,
  EditMessageUseCase,
  DeleteMessageUseCase,
  PresenceConnectUseCase,
  PresenceDisconnectUseCase,
  PresenceHeartbeatUseCase,
  UpdateActivityStatusUseCase,
];
const queries = [
  GetUserChatsQueryHandler,
  GetChatMessagesQueryHandler,
  GetPresenceQueryHandler,
  GetUnreadTotalQueryHandler,
];
const repositories = [
  ChatsRepository,
  ChatsQueryRepository,
  MessagesRepository,
  MessagesQueryRepository,
  PresenceRedisRepository,
  PresenceRepository,
  ChatMuteRepository,
];
const notificationServices = [
  NewMessageNotificationPolicy,
  NewMessageNotificationDispatcherService,
];
const guards = [AccessTokenGuard, ChatMembershipGuard];
const websocketProviders = [MessengerWebSocketGateway, MessengerWebSocketService, SocketAuthService];
const presenceHelpers = [PresenceBroadcastHelper];

@Module({
  imports: [OutboxModule, RabbitMQModule],
  controllers: [
    ChatsController,
    MessagesController,
    ReadStateController,
    ChatSettingsController,
    PresenceController,
  ],
  providers: [
    ...useCases,
    ...queries,
    ...repositories,
    ...notificationServices,
    ...guards,
    ...websocketProviders,
    ...presenceHelpers,
  ],
})
export class MessagingModule {}
