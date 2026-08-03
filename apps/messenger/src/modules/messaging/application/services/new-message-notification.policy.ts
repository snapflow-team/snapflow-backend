import { Injectable } from '@nestjs/common';
import { ChatReadState, Message, MessageDelivery } from '@generated/prisma-messenger';
import { ChatMuteRepository } from '../../infrastructure/chat-mute.repository';
import { ChatsRepository } from '../../infrastructure/chats.repository';
import { MessagesRepository } from '../../infrastructure/messages.repository';
import { PresenceRedisRepository } from '../../infrastructure/presence-redis.repository';

export type NewMessageNotificationDecision =
  | { shouldNotify: true; message: Message }
  | { shouldNotify: false; reason: string };

export type NewMessageNotificationPolicyInput = {
  chatId: number;
  messageId: number;
  recipientId: number;
};

@Injectable()
export class NewMessageNotificationPolicy {
  constructor(
    private readonly messagesRepository: MessagesRepository,
    private readonly presenceRedisRepository: PresenceRedisRepository,
    private readonly chatsRepository: ChatsRepository,
    private readonly chatMuteRepository: ChatMuteRepository,
  ) {}

  async shouldNotify(
    input: NewMessageNotificationPolicyInput,
  ): Promise<NewMessageNotificationDecision> {
    const message: Message | null = await this.messagesRepository.findById(input.messageId);
    if (!message || message.deletedForEveryone) {
      return { shouldNotify: false, reason: 'message_missing_or_deleted' };
    }

    const onlineMap: Map<number, boolean> = await this.presenceRedisRepository.getOnline([
      input.recipientId,
    ]);
    if (onlineMap.get(input.recipientId) === true) {
      return { shouldNotify: false, reason: 'recipient_online' };
    }

    const delivery: MessageDelivery | null = await this.messagesRepository.findDelivery(
      input.messageId,
      input.recipientId,
    );
    if (delivery) {
      return { shouldNotify: false, reason: 'message_delivered' };
    }

    const readState: ChatReadState | null = await this.chatsRepository.findReadState(
      input.chatId,
      input.recipientId,
    );
    if (readState?.lastReadMessageId != null && readState.lastReadMessageId >= input.messageId) {
      return { shouldNotify: false, reason: 'message_read' };
    }

    const muted: boolean = await this.chatMuteRepository.isMuted(input.chatId, input.recipientId);
    if (muted) {
      return { shouldNotify: false, reason: 'chat_muted' };
    }

    return { shouldNotify: true, message };
  }
}
