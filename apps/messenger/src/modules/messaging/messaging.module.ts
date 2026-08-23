import { Module } from '@nestjs/common';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { OutboxModule } from '../outbox/outbox.module';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';
import { ChatMembershipGuard } from './chats/api/guards/chat-membership.guard';
import { ChatsController } from './chats/api/chats.controller';
import { GetUnreadTotalQueryHandler } from './chats/application/queries/get-unread-total.query-handler';
import { GetUserChatsQueryHandler } from './chats/application/queries/get-user-chats.query-handler';
import { GetOrCreateChatUseCase } from './chats/application/usecases/get-or-create-chat.usecase';
import { MarkChatReadUseCase } from './chats/application/usecases/mark-chat-read.usecase';
import { MuteChatUseCase } from './chats/application/usecases/mute-chat.usecase';
import { UnmuteChatUseCase } from './chats/application/usecases/unmute-chat.usecase';
import { ChatsQueryRepository } from './chats/infrastructure/query/chats.query-repository';
import { ChatMuteRepository } from './chats/infrastructure/chat-mute.repository';
import { ChatReadStateRepository } from './chats/infrastructure/chat-read-state.repository';
import { ChatsRepository } from './chats/infrastructure/chats.repository';
import { MessagesController } from './messages/api/messages.controller';
import { MessageAccessGuard } from './messages/api/guards/message-access.guard';
import { GetChatMessagesQueryHandler } from './messages/application/queries/get-chat-messages.query-handler';
import { DeleteMessageUseCase } from './messages/application/usecases/delete-message.usecase';
import { EditMessageUseCase } from './messages/application/usecases/edit-message.usecase';
import { MarkMessageDeliveredUseCase } from './messages/application/usecases/mark-message-delivered.usecase';
import { SendMessageUseCase } from './messages/application/usecases/send-message.usecase';
import { MessagesQueryRepository } from './messages/infrastructure/query/messages.query-repository';
import { MessagesRepository } from './messages/infrastructure/messages.repository';
import { MessengerSettingsController } from './messenger-settings/api/messenger-settings.controller';
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

const authProviders = [AccessTokenGuard, ChatMembershipGuard, MessageAccessGuard];

const chatsProviders = [
  GetOrCreateChatUseCase,
  GetUserChatsQueryHandler,
  GetUnreadTotalQueryHandler,
  MuteChatUseCase,
  UnmuteChatUseCase,
  MarkChatReadUseCase,
  ChatsRepository,
  ChatsQueryRepository,
  ChatMuteRepository,
  ChatReadStateRepository,
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
    PresenceController,
    MessengerSettingsController,
  ],
  providers: [
    ...authProviders,
    ...chatsProviders,
    ...messagesProviders,
    ...presenceProviders,
    ...notificationProviders,
    ...realtimeProviders,
  ],
})
export class MessagingModule {}
