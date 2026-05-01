import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../../database/prisma.service';
import {
  GeneratedUploadUrlCommand,
  GeneratedUploadUrlUseCase,
} from './generate-presigned-url.usecase';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { CryptoService } from '../../../../../../../libs/common/services/crypto.service';
import { FilesModule } from '../../../../files.module';
import { FileStatus } from '@generated/prisma-files';
import { ConfigService } from '@nestjs/config';
import { S3Settings } from '../../../../setup/configuration/s3.settings';
import { GenerateUploadUrlResponse, MimeType } from '../../../../../../../libs/contracts/files';
import { randomUUID } from 'node:crypto';

describe('GeneratedUploadUrlUseCase (Integration)', () => {
  let module: TestingModule;
  let useCase: GeneratedUploadUrlUseCase;
  let prisma: PrismaService;
  let postsMediaKeyPrefix: string;
  let avatarsMediaKeyPrefix: string;
  const getPresignedPutUrlMock = jest.fn();
  const generateUUIDMock = jest.fn();

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [FilesModule],
    })
      .overrideProvider(StorageService)
      .useValue({ getPresignedPutUrl: getPresignedPutUrlMock })
      .overrideProvider(CryptoService)
      .useValue({ generateUUID: generateUUIDMock })
      .compile();

    useCase = module.get<GeneratedUploadUrlUseCase>(GeneratedUploadUrlUseCase);
    prisma = module.get<PrismaService>(PrismaService);

    const configService = module.get<ConfigService>(ConfigService);
    const s3Settings = configService.get<S3Settings>('s3Settings');

    if (!s3Settings) {
      throw new Error('S3 Settings not found in ConfigService. Check your .env.testing!');
    }

    postsMediaKeyPrefix = s3Settings.postsMediaKeyPrefix;
    avatarsMediaKeyPrefix = s3Settings.avatarsMediaKeyPrefix;
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE files, outbox_events RESTART IDENTITY CASCADE');

    getPresignedPutUrlMock.mockClear();
    generateUUIDMock.mockClear();

    getPresignedPutUrlMock.mockImplementation(
      async (key: string) => `https://s3.mock.com/${key}?signature=xxx`,
    );
    generateUUIDMock.mockReturnValue('uuid-default');
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await module.close();
  });

  describe('Позитивные сценарии', () => {
    it('Один PNG-файл — корректный ключ, запись в БД со статусом PENDING, корректный ответ', async () => {
      // 1. Подготавливаем входные данные и моки
      const userId = 100;
      const fileId = 'file-uuid-1';
      generateUUIDMock.mockReturnValueOnce(fileId);

      const command = new GeneratedUploadUrlCommand({
        userId,
        files: [{ mimeType: MimeType.PNG, size: 1024 }],
      });

      // 2. Выполняем use case
      const result: GenerateUploadUrlResponse[] = await useCase.execute(command);
      const expectedKey = `${postsMediaKeyPrefix}/${userId}/${fileId}.png`;
      const expectedUploadUrl = `https://s3.mock.com/${expectedKey}?signature=xxx`;

      // 3. Проверяем ответ
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        fileId,
        uploadUrl: expectedUploadUrl,
      });

      // 4. Проверяем вызов StorageService
      expect(getPresignedPutUrlMock).toHaveBeenCalledTimes(1);
      expect(getPresignedPutUrlMock).toHaveBeenCalledWith(expectedKey, MimeType.PNG, 1024);

      // 5. Проверяем запись в БД
      const createdFile = await prisma.file.findUnique({
        where: { id: fileId },
      });

      expect(createdFile).toBeDefined();
      expect(createdFile?.id).toBe(fileId);
      expect(createdFile?.userId).toBe(userId);
      expect(createdFile?.key).toBe(expectedKey);
      expect(createdFile?.mimeType).toBe(MimeType.PNG);
      expect(createdFile?.size).toBe(1024);
      expect(createdFile?.status).toBe(FileStatus.PENDING);
      expect(createdFile?.deletedAt).toBeNull();
    });

    it('Один JPEG-файл — расширение jpeg корректно извлечено из mimeType', async () => {
      // 1. Подготавливаем входные данные и моки
      const userId = 101;
      const fileId = 'file-uuid-jpeg-1';
      generateUUIDMock.mockReturnValueOnce(fileId);

      const command = new GeneratedUploadUrlCommand({
        userId,
        files: [{ mimeType: MimeType.JPEG, size: 2048 }],
      });

      // 2. Выполняем use case
      const result: GenerateUploadUrlResponse[] = await useCase.execute(command);
      const expectedKey = `${postsMediaKeyPrefix}/${userId}/${fileId}.jpeg`;
      const expectedUploadUrl = `https://s3.mock.com/${expectedKey}?signature=xxx`;

      // 3. Проверяем ответ и ключ с расширением .jpeg
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        fileId,
        uploadUrl: expectedUploadUrl,
      });

      // 4. Проверяем вызов StorageService
      expect(getPresignedPutUrlMock).toHaveBeenCalledTimes(1);
      expect(getPresignedPutUrlMock).toHaveBeenCalledWith(expectedKey, MimeType.JPEG, 2048);

      // 5. Проверяем запись в БД
      const createdFile = await prisma.file.findUnique({
        where: { id: fileId },
      });

      expect(createdFile).toBeDefined();
      expect(createdFile?.id).toBe(fileId);
      expect(createdFile?.userId).toBe(userId);
      expect(createdFile?.key).toBe(expectedKey);
      expect(createdFile?.mimeType).toBe(MimeType.JPEG);
      expect(createdFile?.size).toBe(2048);
      expect(createdFile?.status).toBe(FileStatus.PENDING);
      expect(createdFile?.deletedAt).toBeNull();
    });
    it('Несколько файлов разных типов — порядок ответа сохраняется, для каждого создаётся отдельная PENDING-запись', async () => {
      // 1. Подготавливаем входные данные и моки
      const userId = 200;
      const fileIds = ['id-1', 'id-2', 'id-3'];
      generateUUIDMock
        .mockReturnValueOnce(fileIds[0])
        .mockReturnValueOnce(fileIds[1])
        .mockReturnValueOnce(fileIds[2]);

      const files = [
        { mimeType: MimeType.PNG, size: 100 },
        { mimeType: MimeType.JPEG, size: 200 },
        { mimeType: MimeType.PNG, size: 300 },
      ];
      const command = new GeneratedUploadUrlCommand({ userId, files });

      // 2. Выполняем use case
      const result: GenerateUploadUrlResponse[] = await useCase.execute(command);
      const expectedKeys = [
        `${postsMediaKeyPrefix}/${userId}/${fileIds[0]}.png`,
        `${postsMediaKeyPrefix}/${userId}/${fileIds[1]}.jpeg`,
        `${postsMediaKeyPrefix}/${userId}/${fileIds[2]}.png`,
      ];

      // 3. Проверяем порядок ответа
      expect(result).toHaveLength(3);
      expect(result.map((item) => item.fileId)).toEqual(fileIds);
      expect(result.map((item) => item.uploadUrl)).toEqual(
        expectedKeys.map((key) => `https://s3.mock.com/${key}?signature=xxx`),
      );

      // 4. Проверяем вызовы StorageService
      expect(getPresignedPutUrlMock).toHaveBeenCalledTimes(3);
      expect(getPresignedPutUrlMock).toHaveBeenNthCalledWith(1, expectedKeys[0], MimeType.PNG, 100);
      expect(getPresignedPutUrlMock).toHaveBeenNthCalledWith(
        2,
        expectedKeys[1],
        MimeType.JPEG,
        200,
      );
      expect(getPresignedPutUrlMock).toHaveBeenNthCalledWith(3, expectedKeys[2], MimeType.PNG, 300);

      // 5. Проверяем записи в БД
      const createdFiles = await prisma.file.findMany({
        where: { id: { in: fileIds } },
        orderBy: { id: 'asc' },
      });

      expect(createdFiles).toHaveLength(3);
      expect(createdFiles.map((file) => file.id).sort()).toEqual([...fileIds].sort());

      const expectedById = new Map([
        [fileIds[0], { key: expectedKeys[0], mimeType: MimeType.PNG, size: 100 }],
        [fileIds[1], { key: expectedKeys[1], mimeType: MimeType.JPEG, size: 200 }],
        [fileIds[2], { key: expectedKeys[2], mimeType: MimeType.PNG, size: 300 }],
      ]);

      for (const createdFile of createdFiles) {
        const expected = expectedById.get(createdFile.id);

        expect(expected).toBeDefined();
        expect(createdFile.userId).toBe(userId);
        expect(createdFile.key).toBe(expected?.key);
        expect(createdFile.mimeType).toBe(expected?.mimeType);
        expect(createdFile.size).toBe(expected?.size);
        expect(createdFile.status).toBe(FileStatus.PENDING);
        expect(createdFile.deletedAt).toBeNull();
      }
    });
    it('Используется именно postsMediaKeyPrefix, а не avatars', async () => {
      // 1. Подготавливаем входные данные и моки
      const userId = 102;
      const fileId = 'file-uuid-prefix-1';
      generateUUIDMock.mockReturnValueOnce(fileId);

      const command = new GeneratedUploadUrlCommand({
        userId,
        files: [{ mimeType: MimeType.PNG, size: 1536 }],
      });

      // 2. Выполняем use case
      await useCase.execute(command);
      const generatedKey = getPresignedPutUrlMock.mock.calls[0][0] as string;

      // 3. Проверяем, что используется posts-префикс, а не avatars
      expect(generatedKey.startsWith(postsMediaKeyPrefix)).toBe(true);
      expect(generatedKey).not.toContain(avatarsMediaKeyPrefix);
    });

    it('Без моков CryptoService (опционально, на реальном UUID)', async () => {
      // 1. Подготавливаем входные данные и включаем генерацию реальных UUID
      const userId = 303;
      generateUUIDMock.mockImplementation(() => randomUUID());

      const command = new GeneratedUploadUrlCommand({
        userId,
        files: [
          { mimeType: MimeType.PNG, size: 111 },
          { mimeType: MimeType.JPEG, size: 222 },
        ],
      });

      // 2. Выполняем use case
      const result: GenerateUploadUrlResponse[] = await useCase.execute(command);

      // 3. Проверяем валидность и уникальность UUID
      expect(result).toHaveLength(2);
      expect(result[0].fileId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(result[1].fileId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(result[0].fileId).not.toBe(result[1].fileId);
    });
  });

  describe('Негативные сценарии', () => {
    it('StorageService.getPresignedPutUrl падает — ошибка пробрасывается, в БД ничего не создано', async () => {
      // 1. Подготавливаем входные данные и падение S3
      generateUUIDMock.mockReturnValueOnce('id-storage-fail');
      getPresignedPutUrlMock.mockRejectedValueOnce(new Error('S3 SignatureError'));

      const command = new GeneratedUploadUrlCommand({
        userId: 400,
        files: [{ mimeType: MimeType.PNG, size: 1000 }],
      });

      // 2. Проверяем, что ошибка пробрасывается
      await expect(useCase.execute(command)).rejects.toThrow('S3 SignatureError');

      // 3. Проверяем, что в БД ничего не создано
      const filesCount = await prisma.file.count();
      expect(filesCount).toBe(0);
    });

    it('Один из URL в Promise.all падает — fail-fast, в БД ничего нет', async () => {
      // 1. Подготавливаем входные данные и моки с падением второго вызова
      generateUUIDMock
        .mockReturnValueOnce('id-fail-1')
        .mockReturnValueOnce('id-fail-2')
        .mockReturnValueOnce('id-fail-3');
      getPresignedPutUrlMock
        .mockResolvedValueOnce('https://s3.mock.com/success-1?signature=xxx')
        .mockRejectedValueOnce(new Error('S3 Promise.all fail'))
        .mockResolvedValueOnce('https://s3.mock.com/success-3?signature=xxx');

      const command = new GeneratedUploadUrlCommand({
        userId: 401,
        files: [
          { mimeType: MimeType.PNG, size: 100 },
          { mimeType: MimeType.JPEG, size: 200 },
          { mimeType: MimeType.PNG, size: 300 },
        ],
      });

      // 2. Проверяем fail-fast поведение
      await expect(useCase.execute(command)).rejects.toThrow('S3 Promise.all fail');

      // 3. Проверяем, что createManyPending не оставил записей
      expect(getPresignedPutUrlMock).toHaveBeenCalledTimes(3);
      expect(await prisma.file.count()).toBe(0);
    });

    it('Падение FilesRepository.createManyPending (конфликт по id) — ошибка пробрасывается, presigned-URL уже выданы', async () => {
      // 1. Подготавливаем дубликат в БД и входные данные
      const duplicateId = 'duplicate-id';
      const userId = 402;

      await prisma.file.create({
        data: {
          id: duplicateId,
          userId,
          key: `${postsMediaKeyPrefix}/${userId}/${duplicateId}.png`,
          mimeType: MimeType.PNG,
          size: 999,
          status: FileStatus.PENDING,
        },
      });

      generateUUIDMock.mockReturnValueOnce(duplicateId);

      const command = new GeneratedUploadUrlCommand({
        userId,
        files: [{ mimeType: MimeType.PNG, size: 100 }],
      });

      // 2. Проверяем, что ошибка пробрасывается
      await expect(useCase.execute(command)).rejects.toThrow(/P2002|Unique constraint/i);

      // 3. Проверяем, что presigned-URL успел сгенерироваться, а новых записей не появилось
      expect(getPresignedPutUrlMock).toHaveBeenCalledTimes(1);
      expect(await prisma.file.count()).toBe(1);
    });
  });

  describe('Edge cases', () => {
    it('Пустой массив files — пустой ответ, ноль вызовов', async () => {
      // 1. Подготавливаем пустую команду
      const command = new GeneratedUploadUrlCommand({
        userId: 999,
        files: [],
      });

      // 2. Выполняем use case
      const result: GenerateUploadUrlResponse[] = await useCase.execute(command);

      // 3. Проверяем пустой ответ и отсутствие вызовов
      expect(result).toEqual([]);
      expect(getPresignedPutUrlMock).not.toHaveBeenCalled();
      expect(generateUUIDMock).not.toHaveBeenCalled();
      expect(await prisma.file.count()).toBe(0);
    });

    it('Изоляция по userId — ключ всегда содержит userId владельца', async () => {
      // 1. Подготавливаем входные данные и моки
      const userId = 777;
      generateUUIDMock.mockReturnValueOnce('user-file-1').mockReturnValueOnce('user-file-2');

      const command = new GeneratedUploadUrlCommand({
        userId,
        files: [
          { mimeType: MimeType.PNG, size: 111 },
          { mimeType: MimeType.JPEG, size: 222 },
        ],
      });

      // 2. Выполняем use case
      await useCase.execute(command);

      // 3. Проверяем ключи в вызовах storage и в БД
      const firstKey = getPresignedPutUrlMock.mock.calls[0][0] as string;
      const secondKey = getPresignedPutUrlMock.mock.calls[1][0] as string;

      expect(firstKey).toContain(`/${userId}/`);
      expect(secondKey).toContain(`/${userId}/`);

      const createdFiles = await prisma.file.findMany({ orderBy: { id: 'asc' } });
      expect(createdFiles).toHaveLength(2);
      expect(createdFiles.every((file) => file.key.includes(`/${userId}/`))).toBe(true);
    });
  });
});
