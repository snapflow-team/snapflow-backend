import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Chat } from '@generated/prisma-messenger';
import { Redis } from 'ioredis';
import type { TypingOutboundPayload } from '@contracts/messenger';
import { MessengerWsEvent } from '@contracts/messenger';
import { REDIS_CLIENT_INJECT_TOKEN } from '../../../../../core/providers/provide-tokens/redis-client.inject-token';
import { ChatsRepository } from '../../../infrastructure/chats.repository';
import { MessengerWebSocketService } from '../../../websocket/services/messenger-websocket.service';
import { TypingStopCommand } from '../commands/typing-stop.command';

@CommandHandler(TypingStopCommand)
export class TypingStopUseCase implements ICommandHandler<TypingStopCommand, void> {
  constructor(
    @Inject(REDIS_CLIENT_INJECT_TOKEN) private readonly redis: Redis,
    private readonly chatsRepository: ChatsRepository,
    private readonly messengerWebSocketService: MessengerWebSocketService,
  ) {}

  async execute({ dto }: TypingStopCommand): Promise<void> {
    const chat: Chat | null = await this.chatsRepository.findById(dto.chatId);
    if (!chat) {
      return;
    }

    if (chat.participantAId !== dto.userId && chat.participantBId !== dto.userId) {
      return;
    }

    const peerId: number = this.chatsRepository.getInterlocutorId(chat, dto.userId);

    await this.redis.del(`typing:${dto.chatId}:${dto.userId}`);

    const payload: TypingOutboundPayload = {
      chatId: String(dto.chatId),
      userId: String(dto.userId),
    };

    this.messengerWebSocketService.emitToUser(peerId, MessengerWsEvent.TypingStop, payload);
  }
}
