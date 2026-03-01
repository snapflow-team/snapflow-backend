import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom, timeout } from 'rxjs';
import { DomainException } from '../../../../../../../libs/common/exceptions/damain.exception';
import { DomainExceptionCode } from '../../../../../../../libs/common/exceptions/types/domain-exception-codes';
import { PostsRepository } from '../../infrastructure/posts-repository';
import { PostStatus } from '@generated/prisma';
import { CreatePostInputDto } from '../../api/input-dto/create-post.input-dto';

export type ValidatedFile = {
  fileId: string;
  url: string;
  mimeType: string;
  size: number;
};

export type ValidateFilesResponse =
  | { valid: true; files: ValidatedFile[] }
  | { valid: false; files: [] };

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
    @Inject('FILES_SERVICE') private readonly filesClient: ClientProxy,
    private readonly postsRepository: PostsRepository,
  ) {}

  async execute({ dto, userId, status }: CreatePostCommand): Promise<number> {
    let validatedFiles: ValidatedFile[] = [];

    if (dto.fileIds?.length > 0) {
      const response: ValidateFilesResponse = await lastValueFrom(
        this.filesClient
          .send<ValidateFilesResponse>({ cmd: 'validate_files' }, { userId, fileIds: dto.fileIds })
          .pipe(timeout(3000)),
      );

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
        message: 'Нельзя опубликовать пост без медиа',
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
