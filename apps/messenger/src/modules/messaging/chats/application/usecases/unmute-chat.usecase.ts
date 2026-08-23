import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UnmuteChatCommand } from '../commands/unmute-chat.command';
import { ChatMuteRepository } from '../../infrastructure/chat-mute.repository';

@CommandHandler(UnmuteChatCommand)
export class UnmuteChatUseCase implements ICommandHandler<UnmuteChatCommand, void> {
  constructor(private readonly chatMuteRepository: ChatMuteRepository) {}

  async execute({ dto }: UnmuteChatCommand): Promise<void> {
    await this.chatMuteRepository.remove(dto.chatId, dto.userId);
  }
}
