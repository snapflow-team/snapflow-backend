import { Module } from '@nestjs/common';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { OutboxModule } from '../outbox/outbox.module';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';
import { ChatMembershipGuard } from './sharing/api/guards/chat-membership.guard';
import { ChatsController } from './chats/api/chats.controller';
import { GetUnreadTotalQueryHandler } from './chats/application/queries/get-unread-total.query-handler';
import { GetUserChatsQueryHandler } from './chats/application/queries/get-user-chats.query-handler';
import { GetOrCreateChatUseCase } from './chats/application/usecases/get-or-create-chat.usecase';
import { ChatsQueryRepository } from './chats/infrastructure/query/chats.query-repository';
import { ChatsRepository } from './chats/infrastructure/chats.repository';
import { MessagesController } from './messages/api/messages.controller';
import { GetChatMessagesQueryHandler } from './messages/application/queries/get-chat-messages.query-handler';
import { DeleteMessageUseCase } from './messages/application/usecases/delete-message.usecase';
import { EditMessageUseCase } from './messages/application/usecases/edit-message.usecase';
import { MarkMessageDeliveredUseCase } from './messages/application/usecases/mark-message-delivered.usecase';
import { SendMessageUseCase } from './messages/application/usecases/send-message.usecase';
import { MessagesQueryRepository } from './messages/infrastructure/query/messages.query-repository';
import { MessagesRepository } from './messages/infrastructure/messages.repository';
import { ReadStateController } from './read-state/api/read-state.controller';
import { MarkChatReadUseCase } from './read-state/application/usecases/mark-chat-read.usecase';
import { ChatReadStateRepository } from './read-state/infrastructure/chat-read-state.repository';
import { ChatSettingsController } from './chat-settings/api/chat-settings.controller';
import { MuteChatUseCase } from './chat-settings/application/usecases/mute-chat.usecase';
import { UnmuteChatUseCase } from './chat-settings/application/usecases/unmute-chat.usecase';
import { ChatMuteRepository } from './chat-settings/infrastructure/chat-mute.repository';
import { PresenceController } from './presence/api/presence.controller';
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
import { NewMessageNotificationDispatcherService } from './notifications/application/services/new-message-notification-dispatcher.service';
import { NewMessageNotificationPolicy } from './notifications/application/services/new-message-notification.policy';
import { MessengerWebSocketGateway } from './realtime/gateway/messenger-websocket.gateway';
import { MessengerWebSocketService } from './realtime/services/messenger-websocket.service';
import { SocketAuthService } from './realtime/services/socket-auth.service';

const sharingProviders = [AccessTokenGuard, ChatMembershipGuard];

const chatsProviders = [
  GetOrCreateChatUseCase,
  GetUserChatsQueryHandler,
  GetUnreadTotalQueryHandler,
  ChatsRepository,
  ChatsQueryRepository,
];

const messagesProviders = [
  SendMessageUseCase,
  EditMessageUseCase,
  DeleteMessageUseCase,
  MarkMessageDeliveredUseCase,
  GetChatMessagesQueryHandler,
  MessagesRepository,
  MessagesQueryRepository,
];

const readStateProviders = [MarkChatReadUseCase, ChatReadStateRepository];

const chatSettingsProviders = [MuteChatUseCase, UnmuteChatUseCase, ChatMuteRepository];

const presenceProviders = [
  PresenceConnectUseCase,
  PresenceDisconnectUseCase,
  PresenceHeartbeatUseCase,
  UpdateActivityStatusUseCase,
  TypingStartUseCase,
  TypingStopUseCase,
  GetPresenceQueryHandler,
  PresenceBroadcastHelper,
  PresenceRedisRepository,
  PresenceRepository,
];

const notificationProviders = [
  NewMessageNotificationPolicy,
  NewMessageNotificationDispatcherService,
];

const realtimeProviders = [MessengerWebSocketGateway, MessengerWebSocketService, SocketAuthService];

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
    ...sharingProviders,
    ...chatsProviders,
    ...messagesProviders,
    ...readStateProviders,
    ...chatSettingsProviders,
    ...presenceProviders,
    ...notificationProviders,
    ...realtimeProviders,
  ],
})
export class MessagingModule {}
