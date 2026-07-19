import { Injectable } from '@nestjs/common';
import { Chat, ChatReadState, Prisma } from '@generated/prisma-messenger';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ChatsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(participantIdA: number, participantIdB: number): Promise<Chat> {
    const { participantAId, participantBId } = this.normalizeParticipants(
      participantIdA,
      participantIdB,
    );

    return this.prisma.chat.upsert({
      where: {
        participantAId_participantBId: {
          participantAId,
          participantBId,
        },
      },
      create: {
        participantAId,
        participantBId,
      },
      update: {},
    });
  }

  async updateLastMessage(
    chatId: number,
    lastMessageId: number,
    lastMessageAt: Date,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await tx.chat.update({
      where: { id: chatId },
      data: {
        lastMessageId,
        lastMessageAt,
      },
    });
  }

  async findById(chatId: number): Promise<Chat | null> {
    return this.prisma.chat.findUnique({
      where: { id: chatId },
    });
  }

  async isParticipant(chatId: number, userId: number): Promise<boolean> {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      select: { participantAId: true, participantBId: true },
    });

    if (!chat) {
      return false;
    }

    return chat.participantAId === userId || chat.participantBId === userId;
  }

  getInterlocutorId(chat: Pick<Chat, 'participantAId' | 'participantBId'>, userId: number): number {
    return chat.participantAId === userId ? chat.participantBId : chat.participantAId;
  }

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

  private normalizeParticipants(
    participantIdA: number,
    participantIdB: number,
  ): { participantAId: number; participantBId: number } {
    return participantIdA < participantIdB
      ? { participantAId: participantIdA, participantBId: participantIdB }
      : { participantAId: participantIdB, participantBId: participantIdA };
  }
}
