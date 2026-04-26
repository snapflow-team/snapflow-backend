import { PrismaService } from '../../../../../database/prisma.service';
import { UpdateProfileInfrastructureDto } from './dto/update-profile.infrastructure-dto';
import { Injectable } from '@nestjs/common';
import { Prisma, UserProfile } from '@generated/prisma-snapflow';
import { UpdateAvatarInfrastructureDto } from './dto/update-avatar.infrastructure-dto';

@Injectable()
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

  async createProfile(
    dto: Prisma.UserProfileUncheckedCreateInput,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<UserProfile> {
    return tx.userProfile.create({
      data: dto,
    });
  }

  async updateProfile(
    dto: UpdateProfileInfrastructureDto,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const { profileId, firstName, lastName, dateOfBirth, country, city, aboutMe } = dto;

    await tx.userProfile.update({
      where: {
        id: profileId,
      },
      data: {
        firstName,
        lastName,
        ...(dateOfBirth !== undefined && { dateOfBirth }),
        ...(country !== undefined && { country }),
        ...(city !== undefined && { city }),
        ...(aboutMe !== undefined && { aboutMe }),
      },
    });
  }

  async updateAvatarUrl(
    dto: UpdateAvatarInfrastructureDto,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await tx.userProfile.updateMany({
      where: {
        userId: dto.userId,
      },
      data: {
        avatarUrl: dto.publicUrl,
      },
    });
  }
}
