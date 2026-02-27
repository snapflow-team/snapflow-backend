import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom, timeout } from 'rxjs';
import { DomainException } from '../../../../../../../libs/common/exceptions/damain.exception';
import { DomainExceptionCode } from '../../../../../../../libs/common/exceptions/types/domain-exception-codes';
import { PostsRepository } from '../../infrastructure/posts-repository';
import { CreatePostInputDto } from '../../api/create-post.input-dto';

export type ValidatedFile = {
  fileId: string;
  url: string;
  mimeType: string;
  size: number;
};

type ValidateFilesResponse = { valid: true; files: ValidatedFile[] } | { valid: false; files: [] };

export class CreatePostCommand {
  constructor(
    public readonly dto: CreatePostInputDto,
    public readonly userId: number,
  ) {}
}

@CommandHandler(CreatePostCommand)
export class CreatePostUseCase implements ICommandHandler<CreatePostCommand> {
  constructor(
    @Inject('FILES_SERVICE') private readonly filesClient: ClientProxy,
    private readonly postsRepository: PostsRepository,
  ) {}

  async execute({ dto, userId }: CreatePostCommand) {
    let validatedFiles: ValidatedFile[] = [];
    console.log('dto.fileIds:', dto.fileIds, 'length:', dto.fileIds?.length);

    if (dto.fileIds?.length) {
      const response = await lastValueFrom(
        this.filesClient
          .send<ValidateFilesResponse>({ cmd: 'validate_files' }, { userId, fileIds: dto.fileIds })
          .pipe(timeout(3000)), // увеличил до 3 сек
      );
      console.log('validate_files response:', response);

      if (!response.valid) {
        throw new DomainException({
          code: DomainExceptionCode.BadRequest,
          message: 'Некоторые файлы недоступны или принадлежат другому пользователю',
        });
      }

      validatedFiles = response.files;
    }

    // ← ИСПРАВЛЕНИЕ ЗДЕСЬ
    const post = await this.postsRepository.createPostWithMedia({
      userId,
      description: dto.description,
      medias: validatedFiles.map((file, index) => ({
        fileId: file.fileId, // ← ОБЯЗАТЕЛЬНО!
        url: file.url,
        mimeType: file.mimeType,
        size: file.size,
        position: index,
      })),
    });

    return post;
  }
}
