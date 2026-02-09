import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { MeViewDto } from '../../api/view-dto/me.view-dto';
import { UsersQueryRepository } from '../../../users/infrastructure/users.query-repository';

export class GetMeQuery {
  constructor(public readonly userId: number) {}
}

@QueryHandler(GetMeQuery)
export class GetMeQueryHandler implements IQueryHandler<GetMeQuery, MeViewDto> {
  constructor(private readonly usersQueryRepository: UsersQueryRepository) {}

  async execute({ userId }: GetMeQuery): Promise<MeViewDto> {
    return this.usersQueryRepository.me(userId);
  }
}
