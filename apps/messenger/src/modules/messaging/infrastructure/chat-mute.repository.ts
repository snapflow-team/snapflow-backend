import { Injectable } from '@nestjs/common';
import { ChatMuteSettings, Prisma } from '@generated/prisma-messenger';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ChatMuteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(
    chatId: number,
    userId: number,
    mutedUntil: Date | null,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<ChatMuteSettings> {
    return tx.chatMuteSettings.upsert({
      where: {
        chatId_userId: {
          chatId,
          userId,
        },
      },
      create: {
        chatId,
        userId,
        mutedUntil,
      },
      update: {
        mutedUntil,
      },
    });
  }

  async remove(
    chatId: number,
    userId: number,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await tx.chatMuteSettings.deleteMany({
      where: {
        chatId,
        userId,
      },
    });
  }

  async isMuted(chatId: number, userId: number): Promise<boolean> {
    const settings: ChatMuteSettings | null = await this.prisma.chatMuteSettings.findUnique({
      where: {
        chatId_userId: {
          chatId,
          userId,
        },
      },
    });

    if (!settings) {
      return false;
    }

    if (settings.mutedUntil == null) {
      return true;
    }

    return settings.mutedUntil > new Date();
  }
}
