import { IQueryHandler } from '@nestjs/cqrs';
import { ProfileViewDto } from '../../api/dto/view-dto/profile.view-dto';
import { ProfilesQueryRepository } from '../../infrastructure/query/profiles.query-repository';

export class GetProfileQuery {
  constructor(public readonly userId: number) {}
}

export class GetProfileQueryHandler implements IQueryHandler<GetProfileQuery, ProfileViewDto> {
  constructor(private readonly profilesQueryRepository: ProfilesQueryRepository) {}

  async execute({ userId }: GetProfileQuery): Promise<ProfileViewDto> {
    return this.profilesQueryRepository.findProfileByUserId(userId);
  }
}
