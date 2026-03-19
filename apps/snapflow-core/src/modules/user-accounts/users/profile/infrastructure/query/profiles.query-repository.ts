import { PrismaService } from '../../../../../../database/prisma.service';
import { ProfileViewDto } from '../../api/dto/view-dto/profile.view-dto';
import { Injectable } from '@nestjs/common';
import { NotFoundException } from '../../../../../../common/exceptions/domain-exceptions';
import { UserProfile } from '@generated/prisma-snapflow';
import { ProfileWithUserMetadata } from '../types/profile-with-user-metadata.type';
import { PublicProfileViewDto } from '../../api/dto/view-dto/public-profile.view-dto';

@Injectable()
export class ProfilesQueryRepository {
  constructor(private readonly prisma: PrismaService) {}
  async findProfileByUserIdOrNotFoundFail(userId: number) {
    const profile: UserProfile | null = await this.prisma.userProfile.findFirst({
      where: { userId, deletedAt: null },
    });

    if (!profile) {
      throw new NotFoundException(`The user with the ID (${userId}) does not have a profile`);
    }

    return ProfileViewDto.mapToView(profile);
  }

  async findProfileWithMetadataForUserByIdOrNotFoundFail(
    id: number,
  ): Promise<PublicProfileViewDto> {
    const profile: ProfileWithUserMetadata | null = await this.prisma.userProfile.findFirst({
      where: { id, deletedAt: null },
      include: {
        user: {
          include: {
            _count: {
              select: {
                posts: {
                  where: { deletedAt: null },
                },
              },
            },
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException(`A profile with this ID (${id}) was not found`);
    }

    return PublicProfileViewDto.mapToView(profile);
  }
}
