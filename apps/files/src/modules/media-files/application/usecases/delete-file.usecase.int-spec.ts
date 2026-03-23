import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../../database/prisma.service';
import { DeleteFileCommand, DeleteFileUseCase } from './delete-file.usecase';
import { FilesModule } from '../../../../files.module';
import { FileStatus, OutboxEventStatus, OutboxEventType } from '@generated/prisma-files';
import { DeleteFileResponse } from '../../../../../../../libs/contracts/files';
import { ConfigService } from '@nestjs/config';
import { S3Settings } from '../../../../setup/configuration/s3.settings';

describe('DeleteFileUseCase (Integration)', () => {
  let module: TestingModule;
  let useCase: DeleteFileUseCase;
  let prisma: PrismaService;
  let publicBaseUrl: string;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [FilesModule],
    }).compile();

    useCase = module.get<DeleteFileUseCase>(DeleteFileUseCase);
    prisma = module.get<PrismaService>(PrismaService);

    const configService = module.get<ConfigService>(ConfigService);
    const s3Settings = configService.get<S3Settings>('s3Settings');

    if (!s3Settings) {
      throw new Error('S3 Settings not found in ConfigService. Check your .env.testing!');
    }

    publicBaseUrl = s3Settings.publicBaseUrl;
  });

  beforeEach(async () => {
    // 🔻 Очищаем обе таблицы перед каждым тестом
    await prisma.$executeRawUnsafe('TRUNCATE TABLE files, outbox_events RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await module.close();
  });

  describe('Позитивные сценарии', () => {
    it('должен успешно обновить deletedAt в БД и создать событие в Outbox', async () => {
      const userId = 100;
      const fileId = 'test-file-uuid-1';
      const key = `snapflow/media/avatars/${userId}/${fileId}.png`;
      const fileUrl = `${publicBaseUrl}/${key}`;

      // 1. Создаем файл
      await prisma.file.create({
        data: {
          id: fileId,
          userId,
          key,
          mimeType: 'image/png',
          size: 1024,
          status: FileStatus.UPLOADED,
        },
      });

      const command = new DeleteFileCommand({ userId, fileUrl });

      // 2. Выполняем удаление
      const result: DeleteFileResponse = await useCase.execute(command);

      // 3. Проверяем ответ
      expect(result).toBeDefined();
      expect(result.success).toBe(true);

      // 4. Проверяем, что в БД deletedAt изменился (Soft Delete)
      const fileInDb = await prisma.file.findUnique({
        where: { id: fileId },
      });
      expect(fileInDb).toBeDefined();
      expect(fileInDb?.deletedAt).toEqual(expect.any(Date));

      // 5. Проверяем, что создалось событие в Outbox
      const outboxEvents = await prisma.outboxEvent.findMany();
      expect(outboxEvents).toHaveLength(1);

      const event = outboxEvents[0];
      expect(event.type).toBe(OutboxEventType.DELETE_S3_FILE);
      expect(event.status).toBe(OutboxEventStatus.PENDING);

      // Проверяем, что в payload лежит правильный ключ
      const payload = event.payload as { key: string };
      expect(payload.key).toBe(key);
    });

    it('должен успешно отработать и создать Outbox-событие, даже если файла нет в таблице files (идемпотентность)', async () => {
      const userId = 200;
      const key = `snapflow/media/avatars/${userId}/not-exist.png`;
      const fileUrl = `${publicBaseUrl}/${key}`;

      // БД files изначально пуста

      const command = new DeleteFileCommand({ userId, fileUrl });

      const result: DeleteFileResponse = await useCase.execute(command);
      expect(result.success).toBe(true);

      // Даже если файла не было в БД, UseCase должен положить задачу в Outbox на случай,
      // если файл остался висеть в S3 (например, рассинхрон баз).
      const outboxEvents = await prisma.outboxEvent.findMany();
      expect(outboxEvents).toHaveLength(1);
      expect(outboxEvents[0].type).toBe(OutboxEventType.DELETE_S3_FILE);

      const payload = outboxEvents[0].payload as { key: string };
      expect(payload.key).toBe(key);
    });
  });
});
