import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ProfilesRepository } from '../../infrastructure/profiles.repository';
import { FilesClient } from '../../../../../integrations/files/files.client';
import { UserProfile } from '@generated/prisma-snapflow';

export class DeleteAvatarCommand {
  constructor(public readonly userId: number) {}
}

@CommandHandler(DeleteAvatarCommand)
export class DeleteAvatarUseCase implements ICommandHandler<DeleteAvatarCommand> {
  constructor(
    private readonly profilesRepository: ProfilesRepository,
    private readonly filesClient: FilesClient,
  ) {}

  async execute({ userId }: DeleteAvatarCommand): Promise<void> {
    const profile: UserProfile | null = await this.profilesRepository.findProfileByUserId(userId);

    if (!profile || !profile.avatarUrl) {
      return;
    }

    await this.filesClient.deleteFile({
      userId,
      fileUrl: profile.avatarUrl,
    });

    await this.profilesRepository.updateAvatarUrl({
      userId,
      publicUrl: null,
    });
  }
}
