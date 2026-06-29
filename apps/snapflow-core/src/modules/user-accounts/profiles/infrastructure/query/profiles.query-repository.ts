import { PrismaService } from '../../../../../database/prisma.service';
import { ProfileViewDto } from '../../api/dto/view-dto/profile.view-dto';
import { Injectable } from '@nestjs/common';
import { NotFoundException } from '../../../../../common/exceptions/domain-exceptions';
import { PostStatus } from '@generated/prisma-snapflow';
import { ProfileWithUserMetadata } from '../types/profile-with-user-metadata.type';
import { PublicProfileViewDto } from '../../api/dto/view-dto/public-profile.view-dto';
import { ProfileWithUsername } from '../types/profile-with-username.type';

@Injectable()
export class ProfilesQueryRepository {
  constructor(private readonly prisma: PrismaService) {}
  async findProfileByUserIdOrNotFoundFail(userId: number) {
    const profile: ProfileWithUsername | null = await this.prisma.userProfile.findFirst({
      where: { userId, deletedAt: null },
      include: {
        user: {
          select: {
            username: true,
          },
        },
      },
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
                  where: { deletedAt: null, status: PostStatus.PUBLISHED },
                },
                followers: {
                  where: { deletedAt: null },
                },
                following: {
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
