import { Injectable } from '@nestjs/common';
import { ChatReadState, Message, MessageDelivery } from '@generated/prisma-messenger';
import { ChatMuteRepository } from '../../../chat-settings/infrastructure/chat-mute.repository';
import { MessagesRepository } from '../../../messages/infrastructure/messages.repository';
import { PresenceRedisRepository } from '../../../presence/infrastructure/presence-redis.repository';
import { ChatReadStateRepository } from '../../../read-state/infrastructure/chat-read-state.repository';

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
    private readonly chatReadStateRepository: ChatReadStateRepository,
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

    const readState: ChatReadState | null = await this.chatReadStateRepository.findReadState(
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
