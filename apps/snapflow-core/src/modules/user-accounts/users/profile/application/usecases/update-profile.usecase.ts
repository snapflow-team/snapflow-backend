import { UpdateProfileApplicationDto } from '../dto/update-profile.application-dto';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UserProfile } from '@generated/prisma';
import { ProfilesRepository } from '../../infrastructure/profiles.repository';
import { DomainException } from '../../../../../../../../../libs/common/exceptions/damain.exception';
import { DomainExceptionCode } from '../../../../../../../../../libs/common/exceptions/types/domain-exception-codes';
import { DateService } from '../../../../../../../../../libs/common/services/date.service';

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
        throw new DomainException({
          code: DomainExceptionCode.BadRequest,
          message: 'User must be at least 13 years old to update profile',
        });
      }
    }

    const profile: UserProfile | null = await this.profilesRepository.findProfileByUserId(userId);

    if (!profile) {
      throw new DomainException({
        code: DomainExceptionCode.InternalServerError,
        message: 'User profile is missing. Registration invariant violated',
      });
    }

    await this.profilesRepository.updateProfile({
      profileId: profile.id,
      ...data,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
    });
  }
}
