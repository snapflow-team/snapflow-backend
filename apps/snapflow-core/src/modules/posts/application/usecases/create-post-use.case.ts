import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DomainException } from '../../../../../../../libs/exceptions/http/damain.exception';
import { DomainExceptionCode } from '../../../../../../../libs/exceptions/http/domain-exception-codes';
import { PostsRepository } from '../../infrastructure/posts-repository';
import { PostStatus } from '@generated/prisma';
import { CreatePostInputDto } from '../../api/input-dto/create-post.input-dto';
import { FilesClient } from '../../../integrations/files/files.client';
import { ValidatedFile, ValidateFilesResponse } from '../../../../../../../libs/contracts/files';

export class CreatePostCommand {
  constructor(
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
    let validatedFiles: ValidatedFile[] = [];

    if (dto.fileIds?.length > 0) {
      const response: ValidateFilesResponse = await this.filesClient.validateFiles({
        userId,
        fileIds: dto.fileIds,
      });

      if (!response.valid) {
        throw new DomainException({
          code: DomainExceptionCode.BadRequest,
          message: 'Некоторые файлы недоступны или принадлежат другому пользователю',
        });
      }

      validatedFiles = response.files;
    }

    if (validatedFiles.length === 0) {
      throw new DomainException({
        code: DomainExceptionCode.BadRequest,
        message: 'Пост должен содержать хотя бы одно медиа',
      });
    }

    return await this.postsRepository.createPostWithMedia({
      userId,
      description: dto.description,
      status: status,
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
