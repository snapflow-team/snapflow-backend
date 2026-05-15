import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { File, FileStatus } from '@generated/prisma-files';
import { PendingFilesCleanupService } from './pending-files-cleanup.service';
import { FilesRepository } from '../../infrastructure/repositories/files.repository';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { Configuration } from '../../../../setup/configuration/configuration';
import { S3Settings } from '../../../../setup/configuration/s3.settings';
import { PendingFilesCleanup } from '../constants/pending-files-cleanup.constants';
import { LoggerFactory } from '../../../logger/logger.factory';

function createMockFile(overrides: Partial<File> = {}): File {
  return {
    id: 'file-1',
    userId: 1,
    key: 'uploads/user-1/file-1.png',
    mimeType: 'image/png',
    size: 1234,
    status: FileStatus.PENDING,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

describe('PendingFilesCleanupService (Unit)', () => {
  let service: PendingFilesCleanupService;
  let filesRepositoryMock: Record<keyof FilesRepository, jest.Mock>;
  let storageServiceMock: Record<keyof StorageService, jest.Mock>;
  let configServiceMock: Record<keyof ConfigService<Configuration, true>, jest.Mock>;
  let loggerMock: { log: jest.Mock; warn: jest.Mock; error: jest.Mock };

  beforeEach(async () => {
    loggerMock = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    filesRepositoryMock = {
      createManyPending: jest.fn(),
      createUploaded: jest.fn(),
      confirmManyUploads: jest.fn(),
      lockStalePendingForCleanup: jest.fn(),
      releaseManyToPending: jest.fn(),
      recoverStaleProcessing: jest.fn(),
      deleteByIds: jest.fn(),
      findManyByIdsAndUserId: jest.fn(),
      findManyUploadedByIdsAndUserId: jest.fn(),
      softDelete: jest.fn(),
      prisma: jest.fn(),
    } as unknown as Record<keyof FilesRepository, jest.Mock>;

    storageServiceMock = {
      getPresignedPutUrl: jest.fn(),
      objectExists: jest.fn(),
      uploadFile: jest.fn(),
      deleteFile: jest.fn(),
      getPublicUrl: jest.fn(),
    } as unknown as Record<keyof StorageService, jest.Mock>;

    configServiceMock = {
      get: jest.fn().mockReturnValue({ presignedExpiresIn: 900 } as S3Settings),
    } as unknown as Record<keyof ConfigService<Configuration, true>, jest.Mock>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PendingFilesCleanupService,
        { provide: FilesRepository, useValue: filesRepositoryMock },
        { provide: StorageService, useValue: storageServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
        {
          provide: LoggerFactory,
          useValue: { create: jest.fn().mockReturnValue(loggerMock) },
        },
      ],
    }).compile();

    service = module.get<PendingFilesCleanupService>(PendingFilesCleanupService);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('должен быть определен', () => {
    expect(service).toBeDefined();
    expect(createMockFile()).toEqual(
      expect.objectContaining({
        id: 'file-1',
        status: FileStatus.PENDING,
      }),
    );
  });

  describe('cleanupPendingFiles() — guard и lifecycle', () => {
    it('должен сразу выйти, если isProcessing === true (параллельный запуск)', async () => {
      let releaseLock!: (value: File[]) => void;
      const lockPromise = new Promise<File[]>((resolve) => {
        releaseLock = resolve;
      });

      filesRepositoryMock.recoverStaleProcessing.mockResolvedValue(0);
      filesRepositoryMock.lockStalePendingForCleanup.mockReturnValue(lockPromise);

      const firstRun: Promise<void> = service.cleanupPendingFiles();
      const secondRun: Promise<void> = service.cleanupPendingFiles();

      await secondRun;

      expect(filesRepositoryMock.recoverStaleProcessing).toHaveBeenCalledTimes(1);
      expect(filesRepositoryMock.lockStalePendingForCleanup).toHaveBeenCalledTimes(1);

      releaseLock([]);
      await firstRun;
    });

    it('должен сбрасывать isProcessing в finally после успеха', async () => {
      filesRepositoryMock.recoverStaleProcessing.mockResolvedValue(0);
      filesRepositoryMock.lockStalePendingForCleanup.mockResolvedValue([]);

      await service.cleanupPendingFiles();
      await service.cleanupPendingFiles();

      expect(filesRepositoryMock.lockStalePendingForCleanup).toHaveBeenCalledTimes(2);
    });

    it('должен сбрасывать isProcessing в finally после исключения в lockStalePendingForCleanup', async () => {
      filesRepositoryMock.recoverStaleProcessing.mockResolvedValue(0);
      filesRepositoryMock.lockStalePendingForCleanup
        .mockRejectedValueOnce(new Error('DB lock failed'))
        .mockResolvedValueOnce([]);

      await expect(service.cleanupPendingFiles()).resolves.toBeUndefined();
      await expect(service.cleanupPendingFiles()).resolves.toBeUndefined();

      expect(filesRepositoryMock.lockStalePendingForCleanup).toHaveBeenCalledTimes(2);
      expect(loggerMock.error).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'DB lock failed' }),
        'cleanupPendingFiles',
      );
    });
  });

  describe('cleanupPendingFiles() — расчёт thresholdMinutes', () => {
    it.each([
      { presignedExpiresIn: 900, expectedThreshold: 20 },
      { presignedExpiresIn: 901, expectedThreshold: 21 },
      { presignedExpiresIn: 60, expectedThreshold: 6 },
      { presignedExpiresIn: 30, expectedThreshold: 6 },
    ])(
      'должен считать threshold корректно для presignedExpiresIn=$presignedExpiresIn',
      async ({ presignedExpiresIn, expectedThreshold }) => {
        configServiceMock.get.mockReturnValue({ presignedExpiresIn } as S3Settings);
        filesRepositoryMock.recoverStaleProcessing.mockResolvedValue(0);
        filesRepositoryMock.lockStalePendingForCleanup.mockResolvedValue([]);

        await service.cleanupPendingFiles();

        expect(configServiceMock.get).toHaveBeenCalledWith('s3Settings');
        expect(filesRepositoryMock.recoverStaleProcessing).toHaveBeenCalledWith(
          PendingFilesCleanup.PENDING_CLEANUP_STALE_THRESHOLD_MINUTES,
        );
        expect(filesRepositoryMock.lockStalePendingForCleanup).toHaveBeenCalledWith(
          expectedThreshold,
          PendingFilesCleanup.CLEANUP_BATCH_SIZE,
        );
      },
    );
  });

  describe('cleanupPendingFiles() — восстановление PENDING_CLEANUP', () => {
    it('должен залогировать warn, если recoverStaleProcessing вернул > 0', async () => {
      filesRepositoryMock.recoverStaleProcessing.mockResolvedValue(3);
      filesRepositoryMock.lockStalePendingForCleanup.mockResolvedValue([]);

      await service.cleanupPendingFiles();

      expect(loggerMock.warn).toHaveBeenCalledWith(
        expect.stringContaining('Recovered 3 stale PENDING_CLEANUP files'),
        'cleanupPendingFiles',
      );
      expect(filesRepositoryMock.lockStalePendingForCleanup).toHaveBeenCalledTimes(1);
    });

    it('не должен логировать warn, если recoverStaleProcessing вернул 0', async () => {
      filesRepositoryMock.recoverStaleProcessing.mockResolvedValue(0);
      filesRepositoryMock.lockStalePendingForCleanup.mockResolvedValue([]);

      await service.cleanupPendingFiles();

      expect(loggerMock.warn).not.toHaveBeenCalled();
      expect(filesRepositoryMock.lockStalePendingForCleanup).toHaveBeenCalledTimes(1);
    });
  });

  describe('cleanupPendingFiles() — пустой батч', () => {
    it('должен ранний return, если stalePendingFiles пустой массив', async () => {
      filesRepositoryMock.recoverStaleProcessing.mockResolvedValue(0);
      filesRepositoryMock.lockStalePendingForCleanup.mockResolvedValue([]);

      await service.cleanupPendingFiles();

      expect(storageServiceMock.objectExists).not.toHaveBeenCalled();
      expect(filesRepositoryMock.confirmManyUploads).not.toHaveBeenCalled();
      expect(filesRepositoryMock.releaseManyToPending).not.toHaveBeenCalled();
      expect(filesRepositoryMock.deleteByIds).not.toHaveBeenCalled();
      expect(loggerMock.log).not.toHaveBeenCalled();
    });
  });

  describe('cleanupPendingFiles() — классификация файлов (S3)', () => {
    const files = [
      createMockFile({ id: 'f1', key: 'k1' }),
      createMockFile({ id: 'f2', key: 'k2' }),
      createMockFile({ id: 'f3', key: 'k3' }),
    ];

    beforeEach(() => {
      filesRepositoryMock.recoverStaleProcessing.mockResolvedValue(0);
      filesRepositoryMock.lockStalePendingForCleanup.mockResolvedValue(files);
      filesRepositoryMock.confirmManyUploads.mockResolvedValue(undefined);
      filesRepositoryMock.releaseManyToPending.mockResolvedValue(undefined);
      filesRepositoryMock.deleteByIds.mockResolvedValue(3);
    });

    it('objectExists === true → попадают в idsToRecover (confirmManyUploads)', async () => {
      storageServiceMock.objectExists.mockResolvedValue(true);

      await service.cleanupPendingFiles();

      expect(filesRepositoryMock.confirmManyUploads).toHaveBeenCalledWith(['f1', 'f2', 'f3']);
      expect(filesRepositoryMock.releaseManyToPending).not.toHaveBeenCalled();
      expect(filesRepositoryMock.deleteByIds).not.toHaveBeenCalled();
    });

    it('objectExists === false → попадают в idsToDelete (deleteByIds)', async () => {
      storageServiceMock.objectExists.mockResolvedValue(false);
      filesRepositoryMock.deleteByIds.mockResolvedValue(3);

      await service.cleanupPendingFiles();

      expect(filesRepositoryMock.deleteByIds).toHaveBeenCalledWith(['f1', 'f2', 'f3']);
      expect(filesRepositoryMock.confirmManyUploads).not.toHaveBeenCalled();
      expect(filesRepositoryMock.releaseManyToPending).not.toHaveBeenCalled();
      expect(loggerMock.log).toHaveBeenCalledWith(
        expect.stringContaining('deleted=3'),
        'cleanupPendingFiles',
      );
    });

    it('objectExists бросает ошибку → попадают в idsToRelease (releaseManyToPending)', async () => {
      storageServiceMock.objectExists.mockRejectedValue(new Error('S3 unavailable'));

      await service.cleanupPendingFiles();

      expect(filesRepositoryMock.releaseManyToPending).toHaveBeenCalledWith(['f1', 'f2', 'f3']);
      expect(filesRepositoryMock.confirmManyUploads).not.toHaveBeenCalled();
      expect(filesRepositoryMock.deleteByIds).not.toHaveBeenCalled();
      expect(loggerMock.error).toHaveBeenCalledTimes(3);
      expect(loggerMock.error).toHaveBeenNthCalledWith(
        1,
        expect.any(Error),
        'cleanupPendingFiles',
      );
    });

    it('смешанный сценарий: recover + delete + release с правильным порядком', async () => {
      storageServiceMock.objectExists
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockRejectedValueOnce(new Error('network'));
      filesRepositoryMock.deleteByIds.mockResolvedValue(1);

      await service.cleanupPendingFiles();

      expect(storageServiceMock.objectExists).toHaveBeenNthCalledWith(1, 'k1');
      expect(storageServiceMock.objectExists).toHaveBeenNthCalledWith(2, 'k2');
      expect(storageServiceMock.objectExists).toHaveBeenNthCalledWith(3, 'k3');
      expect(filesRepositoryMock.confirmManyUploads).toHaveBeenCalledWith(['f1']);
      expect(filesRepositoryMock.releaseManyToPending).toHaveBeenCalledWith(['f3']);
      expect(filesRepositoryMock.deleteByIds).toHaveBeenCalledWith(['f2']);

      const confirmOrder = (filesRepositoryMock.confirmManyUploads as jest.Mock).mock.invocationCallOrder[0];
      const releaseOrder = (filesRepositoryMock.releaseManyToPending as jest.Mock).mock
        .invocationCallOrder[0];
      const deleteOrder = (filesRepositoryMock.deleteByIds as jest.Mock).mock.invocationCallOrder[0];

      expect(confirmOrder).toBeLessThan(releaseOrder);
      expect(releaseOrder).toBeLessThan(deleteOrder);
      expect(loggerMock.log).toHaveBeenCalledWith(
        expect.stringContaining('recovered=1 deleted=1 released=1 thresholdMinutes=20'),
        'cleanupPendingFiles',
      );
    });

    it('objectExists бросает не-Error: Logger.error получает пустой stack и файл идет в release', async () => {
      storageServiceMock.objectExists.mockRejectedValue('boom');

      await service.cleanupPendingFiles();

      expect(filesRepositoryMock.releaseManyToPending).toHaveBeenCalledWith(['f1', 'f2', 'f3']);
      expect(loggerMock.error).toHaveBeenNthCalledWith(1, expect.any(Error), 'cleanupPendingFiles');
    });
  });

  describe('cleanupPendingFiles() — итоговый log', () => {
    beforeEach(() => {
      filesRepositoryMock.recoverStaleProcessing.mockResolvedValue(0);
      filesRepositoryMock.confirmManyUploads.mockResolvedValue(undefined);
      filesRepositoryMock.releaseManyToPending.mockResolvedValue(undefined);
    });

    it('при идеальном сценарии (recovered только) лог содержит deleted=0 released=0', async () => {
      filesRepositoryMock.lockStalePendingForCleanup.mockResolvedValue([
        createMockFile({ id: 'f1', key: 'k1' }),
      ]);
      storageServiceMock.objectExists.mockResolvedValue(true);

      await service.cleanupPendingFiles();

      expect(loggerMock.log).toHaveBeenCalledWith(
        expect.stringContaining('recovered=1 deleted=0 released=0 thresholdMinutes=20'),
        'cleanupPendingFiles',
      );
    });

    it('deletedCount берётся из deleteByIds, а не из длины idsToDelete', async () => {
      filesRepositoryMock.lockStalePendingForCleanup.mockResolvedValue([
        createMockFile({ id: 'f1', key: 'k1' }),
        createMockFile({ id: 'f2', key: 'k2' }),
      ]);
      storageServiceMock.objectExists.mockResolvedValue(false);
      filesRepositoryMock.deleteByIds.mockResolvedValue(0);

      await service.cleanupPendingFiles();

      expect(filesRepositoryMock.deleteByIds).toHaveBeenCalledWith(['f1', 'f2']);
      expect(loggerMock.log).toHaveBeenCalledWith(
        expect.stringContaining('recovered=0 deleted=0 released=0 thresholdMinutes=20'),
        'cleanupPendingFiles',
      );
    });
  });

  describe('cleanupPendingFiles() — глобальный catch', () => {
    beforeEach(() => {
      filesRepositoryMock.recoverStaleProcessing.mockResolvedValue(0);
      filesRepositoryMock.lockStalePendingForCleanup.mockResolvedValue([]);
      filesRepositoryMock.confirmManyUploads.mockResolvedValue(undefined);
      filesRepositoryMock.releaseManyToPending.mockResolvedValue(undefined);
      filesRepositoryMock.deleteByIds.mockResolvedValue(0);
      storageServiceMock.objectExists.mockResolvedValue(true);
    });

    it('recoverStaleProcessing бросает Error: исключение не пробрасывается и isProcessing сбрасывается', async () => {
      filesRepositoryMock.recoverStaleProcessing
        .mockRejectedValueOnce(new Error('recover failed'))
        .mockResolvedValueOnce(0);

      await expect(service.cleanupPendingFiles()).resolves.toBeUndefined();
      await expect(service.cleanupPendingFiles()).resolves.toBeUndefined();

      expect(filesRepositoryMock.recoverStaleProcessing).toHaveBeenCalledTimes(2);
      expect(loggerMock.error).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'recover failed' }),
        'cleanupPendingFiles',
      );
    });

    it('lockStalePendingForCleanup бросает Error: исключение не пробрасывается и isProcessing сбрасывается', async () => {
      filesRepositoryMock.lockStalePendingForCleanup
        .mockRejectedValueOnce(new Error('lock failed'))
        .mockResolvedValueOnce([]);

      await expect(service.cleanupPendingFiles()).resolves.toBeUndefined();
      await expect(service.cleanupPendingFiles()).resolves.toBeUndefined();

      expect(filesRepositoryMock.lockStalePendingForCleanup).toHaveBeenCalledTimes(2);
      expect(loggerMock.error).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'lock failed' }),
        'cleanupPendingFiles',
      );
    });

    it('confirmManyUploads бросает Error', async () => {
      filesRepositoryMock.lockStalePendingForCleanup.mockResolvedValue([
        createMockFile({ id: 'f1', key: 'k1' }),
      ]);
      storageServiceMock.objectExists.mockResolvedValue(true);
      filesRepositoryMock.confirmManyUploads
        .mockRejectedValueOnce(new Error('confirm failed'))
        .mockResolvedValueOnce(undefined);

      await expect(service.cleanupPendingFiles()).resolves.toBeUndefined();
      await expect(service.cleanupPendingFiles()).resolves.toBeUndefined();

      expect(filesRepositoryMock.confirmManyUploads).toHaveBeenCalledTimes(2);
      expect(loggerMock.error).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'confirm failed' }),
        'cleanupPendingFiles',
      );
    });

    it('releaseManyToPending бросает Error', async () => {
      filesRepositoryMock.lockStalePendingForCleanup.mockResolvedValue([
        createMockFile({ id: 'f1', key: 'k1' }),
      ]);
      storageServiceMock.objectExists.mockRejectedValue(new Error('s3 check failed'));
      filesRepositoryMock.releaseManyToPending
        .mockRejectedValueOnce(new Error('release failed'))
        .mockResolvedValueOnce(undefined);

      await expect(service.cleanupPendingFiles()).resolves.toBeUndefined();
      await expect(service.cleanupPendingFiles()).resolves.toBeUndefined();

      expect(filesRepositoryMock.releaseManyToPending).toHaveBeenCalledTimes(2);
      expect(loggerMock.error).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'release failed' }),
        'cleanupPendingFiles',
      );
    });

    it('deleteByIds бросает Error', async () => {
      filesRepositoryMock.lockStalePendingForCleanup.mockResolvedValue([
        createMockFile({ id: 'f1', key: 'k1' }),
      ]);
      storageServiceMock.objectExists.mockResolvedValue(false);
      filesRepositoryMock.deleteByIds
        .mockRejectedValueOnce(new Error('delete failed'))
        .mockResolvedValueOnce(1);

      await expect(service.cleanupPendingFiles()).resolves.toBeUndefined();
      await expect(service.cleanupPendingFiles()).resolves.toBeUndefined();

      expect(filesRepositoryMock.deleteByIds).toHaveBeenCalledTimes(2);
      expect(loggerMock.error).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'delete failed' }),
        'cleanupPendingFiles',
      );
    });

    it('не-Error в верхнем catch: Logger.error получает пустой stack', async () => {
      filesRepositoryMock.recoverStaleProcessing.mockRejectedValueOnce('oops').mockResolvedValueOnce(0);

      await expect(service.cleanupPendingFiles()).resolves.toBeUndefined();
      await expect(service.cleanupPendingFiles()).resolves.toBeUndefined();

      expect(filesRepositoryMock.recoverStaleProcessing).toHaveBeenCalledTimes(2);
      expect(loggerMock.error).toHaveBeenCalledWith(expect.anything(), 'cleanupPendingFiles');
    });
  });
});
