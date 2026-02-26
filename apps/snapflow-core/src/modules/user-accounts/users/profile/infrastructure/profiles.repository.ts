import { PrismaService } from '../../../../../database/prisma.service';
import { Prisma, UserProfile } from '@generated/prisma';
import { UpdateProfileInfrastructureDto } from './dto/update-profile.infrastructure-dto';

export class ProfilesRepository {
  constructor(public readonly prisma: PrismaService) {}

  async findProfileByUserId(
    userId: number,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<UserProfile | null> {
    return tx.userProfile.findFirst({
      where: {
        userId,
        deletedAt: null,
      },
    });
  }

  async updateProfile(
    dto: UpdateProfileInfrastructureDto,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const { profileId, username, firstName, lastName, dateOfBirth, country, city, aboutMe } = dto;

    await tx.userProfile.update({
      where: {
        id: profileId,
      },
      data: {
        username,
        firstName,
        lastName,
        ...(dateOfBirth !== undefined && { dateOfBirth }),
        ...(country !== undefined && { country }),
        ...(city !== undefined && { city }),
        ...(aboutMe !== undefined && { aboutMe }),
      },
    });
  }
}
