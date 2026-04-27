import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SaveDraftApplicationDto } from '../dto/save-draft.application-dto';
import {
  BadRequestException,
  InternalServerException,
} from '../../../../common/exceptions/domain-exceptions';
import { PostsRepository } from '../../infrastructure/posts-repository';
import { PostWithMedia } from '../../types/create-media.type';
import { ValidateFilesResponse } from '../../../../../../../libs/contracts/files';
import { FilesClient } from '../../../integrations/files/files.client';
import { OutboxEventType, PostStatus, Prisma } from '@generated/prisma-snapflow';
import { PrismaService } from '../../../../database/prisma.service';
import { OutboxRepository } from '../../outbox/repositories/outbox.repository';

export class SaveDraftCommand {
  constructor(public readonly dto: SaveDraftApplicationDto) {}
}

@CommandHandler(SaveDraftCommand)
export class SaveDraftUseCase implements ICommandHandler<SaveDraftCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postsRepository: PostsRepository,
    private readonly outboxRepository: OutboxRepository,
    private readonly filesClient: FilesClient,
  ) {}

  async execute({ dto: { userId, description, fileIds } }: SaveDraftCommand): Promise<void> {
    if (!fileIds || fileIds.length === 0) {
      throw new BadRequestException('Post requires at least one valid media file');
    }

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

    try {
      await this.prisma.$transaction(async (tx) => {
        const draft: PostWithMedia | null = await this.postsRepository.findDraftByUserId(
          userId,
          tx,
        );

        if (draft) {
          const wasDeleted: boolean = await this.postsRepository.softDeletePostWithMedia(
            draft.id,
            userId,
            tx,
          );

          if (!wasDeleted) {
            throw new InternalServerException('Failed to delete existing draft');
          }

          for (const media of draft.postMedias) {
            await this.outboxRepository.createOutboxEvent(
              OutboxEventType.DELETE_POST_MEDIA_FILE,
              { userId, fileUrl: media.url },
              tx,
            );
          }
        }

        await this.postsRepository.createPostWithMedia(
          {
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
          },
          tx,
        );
      });
    } catch (error) {
      if (this.isDraftUniqueConstraintError(error)) {
        throw new BadRequestException(
          'Another draft save is already in progress, please try again',
        );
      }

      throw error;
    }
  }

  private isDraftUniqueConstraintError(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
      return false;
    }

    const meta = error.meta;
    if (!meta) {
      return false;
    }

    if (meta['modelName'] === 'Post') {
      return true;
    }

    const target = meta['target'];
    if (!target) {
      return false;
    }

    const matchesDraftIndex = (value: string): boolean =>
      value.includes('idx_posts_user_draft_active') || value.includes('user_id');

    return Array.isArray(target)
      ? target.some(matchesDraftIndex)
      : typeof target === 'string' && matchesDraftIndex(target);
  }
}
