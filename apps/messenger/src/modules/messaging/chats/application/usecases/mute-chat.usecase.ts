import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { MuteChatCommand } from '../commands/mute-chat.command';
import { ChatMuteRepository } from '../../infrastructure/chat-mute.repository';

@CommandHandler(MuteChatCommand)
export class MuteChatUseCase implements ICommandHandler<MuteChatCommand, void> {
  constructor(private readonly chatMuteRepository: ChatMuteRepository) {}

  async execute({ dto }: MuteChatCommand): Promise<void> {
    await this.chatMuteRepository.upsert(dto.chatId, dto.userId, dto.mutedUntil);
  }
}
