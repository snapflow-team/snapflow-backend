import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PostsRepository } from '../../infrastructure/posts-repository';
import { CreatePostInputDto } from '../../api/input-dto/create-post.input-dto';
import { BadRequestException } from '../../../../common/exceptions/domain-exceptions';
import { FilesClient } from '../../../integrations/files/files.client';
import { ValidateFilesResponse } from '../../../../../../../libs/contracts/files';
import { PostStatus } from '@generated/prisma-snapflow';

export class CreatePostCommand {
  constructor(
    // todo: вынести параметры в CreatePostApplicationDto
    public readonly dto: CreatePostInputDto,
    public readonly userId: number,
    public readonly status: PostStatus,
  ) {}
}

@CommandHandler(CreatePostCommand)
export class CreatePostUseCase implements ICommandHandler<CreatePostCommand> {
  constructor(
    private readonly filesClient: FilesClient,
    private readonly postsRepository: PostsRepository,
  ) {}

  async execute({ dto, userId, status }: CreatePostCommand): Promise<number> {
    const response: ValidateFilesResponse = await this.filesClient.validateFiles({
      userId,
      fileIds: dto.fileIds,
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
      description: dto.description,
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
