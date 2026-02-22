import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../database/prisma.service';
import { SessionsViewDto } from '../../api/view-dto/sessions.view-dto';
import { Session } from '@generated/prisma';

@Injectable()
export class SessionQueryRepository {
  constructor(private readonly prisma: PrismaService) {}
  // todo: добавить пагинацию
  async getAllSessions(userId: number): Promise<SessionsViewDto[]> {
    const sessions: Session[] = await this.prisma.session.findMany({
      where: {
        userId,
        deletedAt: null,
      },
    });
    return sessions.map((session: Session): SessionsViewDto => SessionsViewDto.mapToView(session));
  }
}
