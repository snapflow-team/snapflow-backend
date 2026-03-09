import { UpdateProfileApplicationDto } from '../dto/update-profile.application-dto';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UserProfile } from '@generated/prisma';
import { ProfilesRepository } from '../../infrastructure/profiles.repository';
import { DateService } from '../../../../../../../../../libs/common/services/date.service';
import { BadRequestException, InternalServerException, } from '../../../../../../common/exceptions/domain-exceptions';

export class UpdateProfileCommand {
  constructor(public readonly dto: UpdateProfileApplicationDto) {}
}

@CommandHandler(UpdateProfileCommand)
export class UpdateProfileUseCase implements ICommandHandler<UpdateProfileCommand> {
  constructor(
    private readonly profilesRepository: ProfilesRepository,
    private readonly dateService: DateService,
  ) {}
  async execute({ dto: { userId, ...data } }: UpdateProfileCommand) {
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

    await this.profilesRepository.updateProfile({
      profileId: profile.id,
      ...data,
      dateOfBirth: this.mapOptionalDate(data.dateOfBirth),
    });
  }

  private mapOptionalDate(value: string | null | undefined): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    return new Date(value);
  }
}
