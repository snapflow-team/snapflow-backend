import { QueryHandler } from '@nestjs/cqrs';
import { SessionQueryRepository } from '../../infrastructure/session.query-repository';
import { SessionView } from '../../../api/view-dto/sessions.view-dto';

export class GetAllSessionsQuery {
  constructor(public readonly userId: number) {}
}

@QueryHandler(GetAllSessionsQuery)
export class GetAllSessionsQueryHandler {
  constructor(private readonly sessionQueryRepository: SessionQueryRepository) {}

  async execute(query: GetAllSessionsQuery): Promise<SessionView[]> {
    return this.sessionQueryRepository.getAllSessions(query.userId);
  }
}
