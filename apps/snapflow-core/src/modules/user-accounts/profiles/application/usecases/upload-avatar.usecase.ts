import { UploadAvatarApplicationDto } from '../dto/apload-avatar.application-dto';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ProfilesRepository } from '../../infrastructure/profiles.repository';
import { FilesClient } from '../../../../integrations/files/files.client';
import {
  UploadFileRequest,
  UploadFileResponse,
} from '../../../../../../../../libs/contracts/files';

export class UploadAvatarCommand {
  constructor(public readonly dto: UploadAvatarApplicationDto) {}
}

@CommandHandler(UploadAvatarCommand)
export class UploadAvatarUseCase implements ICommandHandler<UploadAvatarCommand> {
  constructor(
    private readonly profilesRepository: ProfilesRepository,
    private filesClient: FilesClient,
  ) {}

  async execute({ dto: { userId, mimetype, buffer, size } }: UploadAvatarCommand) {
    const payload: UploadFileRequest = {
      userId,
      mimetype,
      buffer,
      size,
    };

    const { publicUrl }: UploadFileResponse = await this.filesClient.uploadFile(payload);

    await this.profilesRepository.updateAvatarUrl({ userId, publicUrl });

    return { publicUrl };
  }
}
