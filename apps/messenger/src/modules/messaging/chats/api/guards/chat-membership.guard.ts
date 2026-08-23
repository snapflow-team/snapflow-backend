import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '../../../../../common/exceptions/domain-exceptions';
import { UserContextDto } from '../../../../auth/guards/dto/user-context.dto';
import { ChatsRepository } from '../../infrastructure/chats.repository';

@Injectable()
export class ChatMembershipGuard implements CanActivate {
  constructor(private readonly chatsRepository: ChatsRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: UserContextDto }>();
    const userId: number | null = request.user?.id ?? null;

    if (!userId) {
      throw new UnauthorizedException();
    }

    const chatId: number = this.resolveChatId(request.params as Record<string, string | undefined>);
    const isParticipant: boolean = await this.chatsRepository.isParticipant(chatId, userId);

    if (!isParticipant) {
      throw new ForbiddenException('Access denied');
    }

    return true;
  }

  private resolveChatId(params: Record<string, string | undefined>): number {
    const rawChatId: string | null = params.chatId ?? null;

    if (!rawChatId) {
      throw new BadRequestException('Missing chatId');
    }

    const chatId: number = Number(rawChatId);

    if (!Number.isInteger(chatId) || chatId <= 0) {
      throw new BadRequestException('Invalid chatId');
    }

    return chatId;
  }
}
