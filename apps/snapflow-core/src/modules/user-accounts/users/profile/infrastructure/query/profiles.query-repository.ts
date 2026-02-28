import { PrismaService } from '../../../../../../database/prisma.service';
import { UserProfile } from '@generated/prisma';
import { DomainException } from '../../../../../../../../../libs/common/exceptions/damain.exception';
import { DomainExceptionCode } from '../../../../../../../../../libs/common/exceptions/types/domain-exception-codes';
import { ProfileViewDto } from '../../api/dto/view-dto/profile.view-dto';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ProfilesQueryRepository {
  constructor(private readonly prisma: PrismaService) {}
  async findProfileByUserId(userId: number) {
    const profile: UserProfile | null = await this.prisma.userProfile.findFirst({
      where: { userId, deletedAt: null },
    });

    if (!profile) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The user with the ID (${userId}) does not have a profile`,
      });
    }

    return ProfileViewDto.mapToView(profile);
  }
}
