import { DeleteFileApplicationDto } from '../dto/delete-file.application-dto';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { FilesRepository } from '../../infrastructure/repositories/files.repository';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../../../../setup/configuration/configuration';
import { S3Settings } from '../../../../setup/configuration/s3.settings';
import { DeleteFileResponse } from '../../../../../../../libs/contracts/files';
import { PrismaService } from '../../../../database/prisma.service';
import { OutboxEventType } from '@generated/prisma-files';
import { OutboxRepository } from '../../../../core/outbox/repositories/outbox.repository';

export class DeleteFileCommand {
  constructor(public readonly dto: DeleteFileApplicationDto) {}
}

@CommandHandler(DeleteFileCommand)
export class DeleteFileUseCase implements ICommandHandler<DeleteFileCommand> {
  constructor(
    private readonly filesRepository: FilesRepository,
    private readonly outboxRepository: OutboxRepository,
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService<Configuration, true>,
  ) {}

  async execute({ dto: { userId, fileUrl } }: DeleteFileCommand): Promise<DeleteFileResponse> {
    const { publicBaseUrl } = this.configService.get<S3Settings>('s3Settings');

    const key: string = fileUrl.replace(`${publicBaseUrl}/`, '');

    await this.prismaService.$transaction(async (tx) => {
      await this.filesRepository.softDelete(key, userId, tx);
      await this.outboxRepository.createOutboxEvent(OutboxEventType.DELETE_S3_FILE, { key }, tx);
    });

    return { success: true };
  }
}
