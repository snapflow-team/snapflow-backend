import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../database/prisma.service';
import { SessionView } from '../../api/view-dto/sessions.view-dto';
import { Session } from '@generated/prisma';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class SessionQueryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getAllSessions(userId: number): Promise<SessionView[]> {
    const sessions: Session[] = await this.prisma.session.findMany({
      where: {
        userId,
        deletedAt: null,
      },
    });
    return plainToInstance(SessionView, sessions, { excludeExtraneousValues: true });
  }
}
