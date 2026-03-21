import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PostsRepository } from '../../infrastructure/posts-repository';
import { BadRequestException } from '../../../../common/exceptions/domain-exceptions';
import { FilesClient } from '../../../integrations/files/files.client';
import { ValidateFilesResponse } from '../../../../../../../libs/contracts/files';
import { ProfilesRepository } from '../../../user-accounts/users/profile/infrastructure/profiles.repository';
import { CreatePostApplicationDto } from '../dto/create-post-application.dto';

export class CreatePostCommand {
  constructor(public readonly dto: CreatePostApplicationDto) {}
}

@CommandHandler(CreatePostCommand)
export class CreatePostUseCase implements ICommandHandler<CreatePostCommand> {
  constructor(
    private readonly filesClient: FilesClient,
    private readonly postsRepository: PostsRepository,
    private readonly profilesRepository: ProfilesRepository,
  ) {}

  async execute({ dto }: CreatePostCommand): Promise<number> {
    const { userId, status, description, fileIds } = dto;

    if (!fileIds || fileIds.length === 0) {
      throw new BadRequestException("You can't publish a post without media");
    }

    const profile = await this.profilesRepository.findProfileByUserId(userId);

    if (!profile) {
      throw new BadRequestException('Profile required to create post');
    }
    const response: ValidateFilesResponse = await this.filesClient.validateFiles({
      userId,
      fileIds: fileIds,
    });

    if (!response.valid) {
      throw new BadRequestException('Some files do not belong to you');
    }

    const validatedFiles = response.files;

    if (validatedFiles.length === 0) {
      throw new BadRequestException('Post requires at least one valid media file');
    }

    return this.postsRepository.createPostWithMedia({
      userId,
      description: description,
      status,
      medias: validatedFiles.map((file, index) => ({
        fileId: file.fileId,
        url: file.url,
        mimeType: file.mimeType,
        size: file.size,
        position: index,
      })),
    });
  }
}
