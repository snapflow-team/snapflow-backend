import { UpdateProfileApplicationDto } from '../dto/update-profile.application-dto';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ProfilesRepository } from '../../infrastructure/profiles.repository';
import { DateService } from '../../../../../../../../../libs/common/services/date.service';
import {
  BadRequestException,
  InternalServerException,
} from '../../../../../../common/exceptions/domain-exceptions';
import { Prisma, User, UserProfile } from '@generated/prisma-snapflow';
import { UsersRepository } from '../../../infrastructure/users.repository';
import { PrismaService } from '../../../../../../database/prisma.service';

export class UpdateProfileCommand {
  constructor(public readonly dto: UpdateProfileApplicationDto) {}
}

@CommandHandler(UpdateProfileCommand)
export class UpdateProfileUseCase implements ICommandHandler<UpdateProfileCommand> {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly profilesRepository: ProfilesRepository,
    private readonly prismaService: PrismaService,
    private readonly dateService: DateService,
  ) {}
  async execute({ dto: { userId, ...data } }: UpdateProfileCommand): Promise<void> {
    if (data.dateOfBirth) {
      const dob = new Date(data.dateOfBirth);
      const age: number = this.dateService.getAge(dob);

      if (age < 13) {
        throw new BadRequestException('User must be at least 13 years old to update profile');
      }
    }

    const profile: UserProfile | null = await this.profilesRepository.findProfileByUserId(userId);

    if (!profile) {
      throw new InternalServerException('User profile is missing. Registration invariant violated');
    }

    const userWithSameUsername: User | null = await this.usersRepository.findUserByUsername(
      data.username,
    );

    if (userWithSameUsername && userWithSameUsername.id !== userId) {
      throw new BadRequestException('This username is already taken');
    }

    try {
      await this.prismaService.$transaction(async (tx) => {
        await this.usersRepository.updateUsername(userId, data.username, tx);
        await this.profilesRepository.updateProfile(
          {
            profileId: profile.id,
            firstName: data.firstName,
            lastName: data.lastName,
            country: data.country,
            city: data.city,
            aboutMe: data.aboutMe,
            dateOfBirth: this.mapOptionalDate(data.dateOfBirth),
          },
          tx,
        );
      });
    } catch (error) {
      if (this.isUsernameUniqueConstraintError(error)) {
        throw new BadRequestException('This username is already taken');
      }

      throw error;
    }
  }

  private mapOptionalDate(value: string | null | undefined): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    return new Date(value);
  }

  private isUsernameUniqueConstraintError(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
      return false;
    }

    const target = error.meta?.['target'];
    if (!target) {
      return false;
    }

    return Array.isArray(target)
      ? target.includes('username')
      : typeof target === 'string' && target.includes('username');
  }
}
