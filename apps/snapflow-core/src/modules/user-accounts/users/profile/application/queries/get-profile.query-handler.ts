import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ProfileViewDto } from '../../api/dto/view-dto/profile.view-dto';
import { ProfilesQueryRepository } from '../../infrastructure/query/profiles.query-repository';
import { UsersRepository } from '../../../infrastructure/users.repository';
import { NotFoundException } from '../../../../../../common/exceptions/domain-exceptions';
import { User } from '@generated/prisma-snapflow';

export class GetProfileQuery {
  constructor(public readonly userId: number) {}
}

@QueryHandler(GetProfileQuery)
export class GetProfileQueryHandler implements IQueryHandler<GetProfileQuery, ProfileViewDto> {
  constructor(
    private readonly profilesQueryRepository: ProfilesQueryRepository,
    private readonly usersRepository: UsersRepository,
  ) {}

  async execute({ userId }: GetProfileQuery): Promise<ProfileViewDto> {
    const user: User | null = await this.usersRepository.findUserById(userId);

    if (!user) {
      throw new NotFoundException(`The user with ID (${userId}) does not exist`);
    }

    return this.profilesQueryRepository.findProfileByUserId(userId);
  }
}
