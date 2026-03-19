import { PrismaService } from '../../../../../../database/prisma.service';
import { ProfileViewDto } from '../../api/dto/view-dto/profile.view-dto';
import { Injectable } from '@nestjs/common';
import { NotFoundException } from '../../../../../../common/exceptions/domain-exceptions';
import { UserProfile } from '@generated/prisma-snapflow';

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
}
