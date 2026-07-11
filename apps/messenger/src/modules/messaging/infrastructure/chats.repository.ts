import { Injectable } from '@nestjs/common';
import { Chat } from '@generated/prisma-messenger';
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

  private normalizeParticipants(
    participantIdA: number,
    participantIdB: number,
  ): { participantAId: number; participantBId: number } {
    return participantIdA < participantIdB
      ? { participantAId: participantIdA, participantBId: participantIdB }
      : { participantAId: participantIdB, participantBId: participantIdA };
  }
}
