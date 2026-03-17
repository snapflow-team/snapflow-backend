import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../../database/prisma.service'; // Путь к Prisma микросервиса файлов
import { DeleteFileCommand, DeleteFileUseCase } from './delete-file.usecase';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { FilesModule } from '../../../../files.module'; // Главный модуль микросервиса
import { FileStatus } from '@generated/prisma-files';
import { DeleteFileResponse } from '../../../../../../../libs/contracts/files';
import { ConfigService } from '@nestjs/config';
import { S3Settings } from '../../../../setup/configuration/s3.settings'; // Путь к сгенерированному клиенту

describe('DeleteFileUseCase (Integration)', () => {
  let module: TestingModule;
  let useCase: DeleteFileUseCase;
  let prisma: PrismaService;
  let publicBaseUrl: string;

  const deleteFileMock = jest.fn();

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [FilesModule],
    })
      .overrideProvider(StorageService)
      .useValue({ deleteFile: deleteFileMock })
      .compile();

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
    await prisma.$executeRawUnsafe('TRUNCATE TABLE files RESTART IDENTITY CASCADE');

    deleteFileMock.mockClear();
    deleteFileMock.mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await module.close();
  });

  describe('Позитивные сценарии', () => {
    it('должен успешно извлечь S3 key, обновить deletedAt в БД и удалить физический файл', async () => {
      const userId = 100;
      const fileId = 'test-file-uuid-1';
      const key = `snapflow/media/avatars/${userId}/${fileId}.png`;
      const fileUrl = `${publicBaseUrl}/${key}`;

      // 1. Arrange: Создаем реальную запись файла в БД
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

      const command = new DeleteFileCommand({
        userId,
        fileUrl,
      });

      // 2. Выполняем удаление
      const result: DeleteFileResponse = await useCase.execute(command);

      // 3. Проверяем ответ
      expect(result).toBeDefined();
      expect(result.success).toBe(true);

      // 4. Проверяем, что StorageService вызван с правильным ключом (без базового URL)
      expect(deleteFileMock).toHaveBeenCalledTimes(1);
      expect(deleteFileMock).toHaveBeenCalledWith(key);

      // 5. Проверяем, что в БД deletedAt изменился (Soft Delete)
      const fileInDb = await prisma.file.findUnique({
        where: { id: fileId },
      });

      expect(fileInDb).toBeDefined();
      expect(fileInDb?.deletedAt).toEqual(expect.any(Date));
    });

    it('должен успешно отработать, даже если файл с таким URL не найден в БД (идемпотентность)', async () => {
      const userId = 200;
      const key = `snapflow/media/avatars/${userId}/not-exist.png`;
      const fileUrl = `${publicBaseUrl}/${key}`;

      // БД изначально пуста

      const command = new DeleteFileCommand({ userId, fileUrl });

      const result: DeleteFileResponse = await useCase.execute(command);

      expect(result.success).toBe(true);

      // Несмотря на то, что в БД файла нет, мы все равно должны послать команду удаления в S3
      // (так как S3 DeleteObjectCommand идемпотентна и не падает, если файла нет)
      expect(deleteFileMock).toHaveBeenCalledTimes(1);
      expect(deleteFileMock).toHaveBeenCalledWith(key);
    });
  });

  describe('Негативные сценарии', () => {
    it('должен выбросить ошибку и не изменять БД, если StorageService (S3) упал при удалении', async () => {
      const userId = 300;
      const fileId = 'test-file-uuid-3';
      const key = `snapflow/media/avatars/${userId}/${fileId}.png`;
      const fileUrl = `${publicBaseUrl}/${key}`;

      // Создаем файл в БД
      await prisma.file.create({
        data: {
          id: fileId,
          userId,
          key,
          mimeType: 'image/png',
          size: 2048,
          status: FileStatus.UPLOADED,
        },
      });

      // Имитируем падение сети до AWS S3
      deleteFileMock.mockRejectedValueOnce(new Error('S3 Network Error'));

      const command = new DeleteFileCommand({ userId, fileUrl });

      await expect(useCase.execute(command)).rejects.toThrow('S3 Network Error');

      // Проверяем, что из-за ошибки в StorageService транзакция/операция прервалась
      const fileInDb = await prisma.file.findUnique({
        where: { id: fileId },
      });

      expect(fileInDb?.deletedAt).toBeNull();
    });
  });
});
