import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SaveDraftApplicationDto } from '../dto/save-draft.application-dto';
import { BadRequestException } from '../../../../common/exceptions/domain-exceptions';
import { PostsRepository } from '../../infrastructure/posts-repository';
import { PostWithMedia } from '../../types/create-media.type';
import { ValidateFilesResponse } from '../../../../../../../libs/contracts/files';
import { FilesClient } from '../../../integrations/files/files.client';
import { DeletePostCommand } from './delete-post.use.case';
import { PostStatus } from '@generated/prisma-snapflow';

export class SaveDraftCommand {
  constructor(public readonly dto: SaveDraftApplicationDto) {}
}

@CommandHandler(SaveDraftCommand)
export class SaveDraftUseCase implements ICommandHandler<SaveDraftCommand> {
  constructor(
    private readonly postsRepository: PostsRepository,
    private readonly filesClient: FilesClient,
    public readonly commandBus: CommandBus,
  ) {}

  async execute({ dto: { userId, description, fileIds } }: SaveDraftCommand) {
    const { valid, files }: ValidateFilesResponse = await this.filesClient.validateFiles({
      userId,
      fileIds,
    });

    if (!valid) {
      throw new BadRequestException("Couldn't confirm files upload");
    }

    if (files.length === 0) {
      throw new BadRequestException('Post requires at least one valid media file');
    }

    const draft: PostWithMedia | null = await this.postsRepository.findDraftByUserId(userId);

    if (draft) {
      await this.commandBus.execute(new DeletePostCommand(userId, draft.id));
    }

    // vilyamz: добиться атомарности при удалении старого черновика и создания нового
    return this.postsRepository.createPostWithMedia({
      userId,
      description,
      status: PostStatus.DRAFT,
      medias: files.map((file, index) => ({
        fileId: file.fileId,
        url: file.url,
        mimeType: file.mimeType,
        size: file.size,
        position: index,
      })),
    });
  }
}
