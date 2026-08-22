import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '../../../../../common/exceptions/domain-exceptions';
import { UserContextDto } from '../../../../auth/guards/dto/user-context.dto';
import { ChatsRepository } from '../../../infrastructure/chats.repository';
import { MessagesRepository } from '../../../infrastructure/messages.repository';
import { Message } from '@generated/prisma-messenger';

@Injectable()
export class ChatMembershipGuard implements CanActivate {
  constructor(
    private readonly chatsRepository: ChatsRepository,
    private readonly messagesRepository: MessagesRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: UserContextDto }>();
    const userId: number | null = request.user?.id ?? null;

    if (!userId) {
      throw new UnauthorizedException();
    }

    const chatId: number = await this.resolveChatId(
      request.params as Record<string, string | undefined>,
    );
    const isParticipant: boolean = await this.chatsRepository.isParticipant(chatId, userId);

    if (!isParticipant) {
      throw new ForbiddenException('Access denied');
    }

    return true;
  }

  private async resolveChatId(params: Record<string, string | undefined>): Promise<number> {
    const rawChatId: string | null = params.chatId ?? null;

    if (rawChatId) {
      const chatId: number = Number(rawChatId);

      if (!Number.isInteger(chatId) || chatId <= 0) {
        throw new BadRequestException('Invalid chatId');
      }

      return chatId;
    }

    const rawMessageId: string | null = params.messageId ?? null;

    if (rawMessageId) {
      const messageId: number = Number(rawMessageId);

      if (!Number.isInteger(messageId) || messageId <= 0) {
        throw new BadRequestException('Invalid messageId');
      }

      const message: Message | null = await this.messagesRepository.findById(messageId);

      if (!message) {
        throw new ForbiddenException('Access denied');
      }

      return message.chatId;
    }

    throw new BadRequestException('Missing chatId or messageId');
  }
}
