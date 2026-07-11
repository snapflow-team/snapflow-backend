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

  private normalizeParticipants(
    participantIdA: number,
    participantIdB: number,
  ): { participantAId: number; participantBId: number } {
    return participantIdA < participantIdB
      ? { participantAId: participantIdA, participantBId: participantIdB }
      : { participantAId: participantIdB, participantBId: participantIdA };
  }
}
