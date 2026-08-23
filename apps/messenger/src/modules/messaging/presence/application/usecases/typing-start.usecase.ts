import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Chat } from '@generated/prisma-messenger';
import { Redis } from 'ioredis';
import type { TypingOutboundPayload } from '@contracts/messenger';
import { MessengerWsEvent } from '@contracts/messenger';
import { REDIS_CLIENT_INJECT_TOKEN } from '../../../../../core/providers/provide-tokens/redis-client.inject-token';
import { Configuration } from '../../../../../setup/configuration/configuration';
import { BusinessRulesSettings } from '../../../../../setup/configuration/business-rules-settings';
import { ChatsRepository } from '../../../chats/infrastructure/chats.repository';
import { MessengerWebSocketService } from '../../../realtime/services/messenger-websocket.service';
import { TypingStartCommand } from '../commands/typing-start.command';

@CommandHandler(TypingStartCommand)
export class TypingStartUseCase implements ICommandHandler<TypingStartCommand, void> {
  constructor(
    @Inject(REDIS_CLIENT_INJECT_TOKEN) private readonly redis: Redis,
    private readonly configService: ConfigService<Configuration, true>,
    private readonly chatsRepository: ChatsRepository,
    private readonly messengerWebSocketService: MessengerWebSocketService,
  ) {}

  async execute({ dto }: TypingStartCommand): Promise<void> {
    const chat: Chat | null = await this.chatsRepository.findById(dto.chatId);
    if (!chat) {
      return;
    }

    if (chat.participantAId !== dto.userId && chat.participantBId !== dto.userId) {
      return;
    }

    const peerId: number = this.chatsRepository.getInterlocutorId(chat, dto.userId);
    const ttlSeconds: number =
      this.configService.get<BusinessRulesSettings>('businessRulesSettings').typingTtlSeconds;

    await this.redis.set(`typing:${dto.chatId}:${dto.userId}`, '1', 'EX', ttlSeconds);

    const payload: TypingOutboundPayload = {
      chatId: String(dto.chatId),
      userId: String(dto.userId),
    };

    this.messengerWebSocketService.emitToUser(peerId, MessengerWsEvent.TypingStart, payload);
  }
}
