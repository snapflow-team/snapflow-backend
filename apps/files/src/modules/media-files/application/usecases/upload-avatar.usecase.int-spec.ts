import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../../database/prisma.service'; // Подставь свой путь
import { UploadAvatarCommand, UploadAvatarUseCase } from './upload-avatar.usecase';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { CryptoService } from '../../../../../../../libs/common/services/crypto.service';
import { FilesModule } from '../../../../files.module';
import { UploadFileResponse } from '../../../../../../../libs/contracts/files';
import { FileStatus } from '@generated/prisma-files';
import sharp from 'sharp';

describe('UploadAvatarUseCase (Integration)', () => {
  let module: TestingModule;
  let useCase: UploadAvatarUseCase;
  let prisma: PrismaService;
  let validPngBuffer: Buffer;
  let validJpegBuffer: Buffer;
  let invalidBuffer: Buffer;
  const uploadFileMock = jest.fn();
  const generateUUIDMock = jest.fn();

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [FilesModule],
    })
      .overrideProvider(StorageService)
      .useValue({ uploadFile: uploadFileMock })
      .overrideProvider(CryptoService)
      .useValue({ generateUUID: generateUUIDMock })
      .compile();

    useCase = module.get<UploadAvatarUseCase>(UploadAvatarUseCase);
    prisma = module.get<PrismaService>(PrismaService);

    validPngBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    validJpegBuffer = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 0, g: 255, b: 0 } },
    })
      .jpeg()
      .toBuffer();

    invalidBuffer = Buffer.from('invalid-buffer', 'utf-8');
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE files RESTART IDENTITY CASCADE');

    uploadFileMock.mockClear();
    generateUUIDMock.mockClear();

    // Дефолтное поведение моков
    generateUUIDMock.mockReturnValue('test-uuid-1234');
    uploadFileMock.mockImplementation(async (key: string) => `https://s3.mock.com/${key}`);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await module.close();
  });

  describe('Позитивные сценарии', () => {
    it('должен успешно обработать PNG (ресайз + оптимизация), загрузить в S3 и создать запись в БД', async () => {
      const command = new UploadAvatarCommand({
        userId: 100,
        mimetype: 'image/png',
        buffer: validPngBuffer,
      });

      const result: UploadFileResponse = await useCase.execute(command);

      const expectedKey = 'snapflow/media/avatars/100/test-uuid-1234.png';

      // 1. Проверяем возвращаемый результат
      expect(result).toBeDefined();
      expect(result.publicUrl).toBe(`https://s3.mock.com/${expectedKey}`);

      // 2. Проверяем, что S3 был вызван с правильным ключом и буфером
      expect(uploadFileMock).toHaveBeenCalledTimes(1);
      expect(uploadFileMock).toHaveBeenCalledWith(expectedKey, expect.any(Buffer), 'image/png');

      // 3. Проверяем, что в БД создалась запись
      const createdFile = await prisma.file.findUnique({
        where: { id: 'test-uuid-1234' },
      });
      console.log(createdFile);

      expect(createdFile).toBeDefined();
      expect(createdFile?.userId).toBe(100);
      expect(createdFile?.key).toBe(expectedKey);
      expect(createdFile?.mimeType).toBe('image/png');
      expect(createdFile?.status).toBe(FileStatus.UPLOADED);
      expect(createdFile?.size).toBeGreaterThan(0);
    });

    it('должен успешно обработать JPEG/JPG (с применением mozjpeg) и сохранить в БД', async () => {
      const command = new UploadAvatarCommand({
        userId: 200,
        mimetype: 'image/jpeg',
        buffer: validJpegBuffer,
      });

      const result: UploadFileResponse = await useCase.execute(command);

      const expectedKey = 'snapflow/media/avatars/200/test-uuid-1234.jpeg';

      expect(result.publicUrl).toBe(`https://s3.mock.com/${expectedKey}`);
      expect(uploadFileMock).toHaveBeenCalledWith(expectedKey, expect.any(Buffer), 'image/jpeg');

      const createdFile = await prisma.file.findUnique({
        where: { id: 'test-uuid-1234' },
      });
      expect(createdFile?.mimeType).toBe('image/jpeg');
    });
  });

  describe('Негативные сценарии', () => {
    it('должен выбросить ошибку и ничего не сохранять, если буфер не является валидным изображением (sharp error)', async () => {
      const command = new UploadAvatarCommand({
        userId: 300,
        mimetype: 'image/png',
        buffer: invalidBuffer,
      });

      // sharp(.toBuffer) должен упасть с ошибкой
      await expect(useCase.execute(command)).rejects.toThrow();

      // Проверяем, что до загрузки в хранилище дело не дошло
      expect(uploadFileMock).not.toHaveBeenCalled();

      // Проверяем, что в БД ничего не создалось
      const count: number = await prisma.file.count();
      expect(count).toBe(0);
    });

    it('должен выбросить ошибку и не сохранять в БД, если S3 Storage упал при загрузке', async () => {
      // Имитируем ошибку загрузки в S3 (например, нет доступов)
      uploadFileMock.mockRejectedValueOnce(new Error('S3 Access Denied'));

      const command = new UploadAvatarCommand({
        userId: 400,
        mimetype: 'image/png',
        buffer: validPngBuffer,
      });

      // UseCase должен пробросить эту ошибку дальше
      await expect(useCase.execute(command)).rejects.toThrow('S3 Access Denied');

      // Проверяем, что запись в БД НЕ была создана, так как S3 упал до вызова репозитория
      const count: number = await prisma.file.count();
      expect(count).toBe(0);
    });
  });
});
