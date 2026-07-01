import { QueryHandler } from '@nestjs/cqrs';
import { SessionQueryRepository } from '../../infrastructure/session.query-repository';
import { SessionsViewDto } from '../../api/dto/view-dto/sessions.view-dto';

export class GetAllSessionsQuery {
  constructor(
    public readonly userId: number,
    public readonly currentDeviceId: string,
  ) {}
}

@QueryHandler(GetAllSessionsQuery)
export class GetAllSessionsQueryHandler {
  constructor(private readonly sessionQueryRepository: SessionQueryRepository) {}

  async execute(query: GetAllSessionsQuery): Promise<SessionsViewDto[]> {
    return this.sessionQueryRepository.getAllSessions(query.userId, query.currentDeviceId);
  }
}
