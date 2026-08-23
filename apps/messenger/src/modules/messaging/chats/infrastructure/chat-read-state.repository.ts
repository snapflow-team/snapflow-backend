import { Injectable } from '@nestjs/common';
import { ChatReadState, Prisma } from '@generated/prisma-messenger';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class ChatReadStateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findReadState(chatId: number, userId: number): Promise<ChatReadState | null> {
    return this.prisma.chatReadState.findUnique({
      where: {
        chatId_userId: {
          chatId,
          userId,
        },
      },
    });
  }

  async upsertReadState(
    chatId: number,
    userId: number,
    lastReadMessageId: number,
    lastReadAt: Date,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<ChatReadState> {
    return tx.chatReadState.upsert({
      where: {
        chatId_userId: {
          chatId,
          userId,
        },
      },
      create: {
        chatId,
        userId,
        lastReadMessageId,
        lastReadAt,
      },
      update: {
        lastReadMessageId,
        lastReadAt,
      },
    });
  }
}
