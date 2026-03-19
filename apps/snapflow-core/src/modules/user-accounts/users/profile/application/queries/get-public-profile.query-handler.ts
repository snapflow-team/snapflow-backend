import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ProfilesQueryRepository } from '../../infrastructure/query/profiles.query-repository';
import { PublicProfileViewDto } from '../../api/dto/view-dto/public-profile.view-dto';

export class GetPublicProfileQuery {
  constructor(public readonly profileId: number) {}
}

@QueryHandler(GetPublicProfileQuery)
export class GetPublicProfileQueryHandler
  implements IQueryHandler<GetPublicProfileQuery, PublicProfileViewDto>
{
  constructor(private readonly profilesQueryRepository: ProfilesQueryRepository) {}

  async execute({ profileId }: GetPublicProfileQuery): Promise<PublicProfileViewDto> {
    return this.profilesQueryRepository.findProfileWithMetadataForUserByIdOrNotFoundFail(profileId);
  }
}
