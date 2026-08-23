import { Test, TestingModule } from '@nestjs/testing';
import { ChatMuteSettings } from '@generated/prisma-messenger';
import { PrismaService } from '../../../database/prisma.service';
import { ChatMuteRepository } from './chat-mute.repository';

describe('ChatMuteRepository (unit)', () => {
  let repository: ChatMuteRepository;
  let prismaMock: {
    chatMuteSettings: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
      deleteMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaMock = {
      chatMuteSettings: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatMuteRepository, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    repository = module.get(ChatMuteRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('isMuted: false, если записи нет', async () => {
    prismaMock.chatMuteSettings.findUnique.mockResolvedValue(null);

    await expect(repository.isMuted(10, 2)).resolves.toBe(false);
  });

  it('isMuted: true при бессрочном mute (mutedUntil = null)', async () => {
    prismaMock.chatMuteSettings.findUnique.mockResolvedValue({
      chatId: 10,
      userId: 2,
      mutedUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as ChatMuteSettings);

    await expect(repository.isMuted(10, 2)).resolves.toBe(true);
  });

  it('isMuted: true, если mutedUntil в будущем', async () => {
    prismaMock.chatMuteSettings.findUnique.mockResolvedValue({
      chatId: 10,
      userId: 2,
      mutedUntil: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as ChatMuteSettings);

    await expect(repository.isMuted(10, 2)).resolves.toBe(true);
  });

  it('isMuted: false, если mutedUntil истёк', async () => {
    prismaMock.chatMuteSettings.findUnique.mockResolvedValue({
      chatId: 10,
      userId: 2,
      mutedUntil: new Date(Date.now() - 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as ChatMuteSettings);

    await expect(repository.isMuted(10, 2)).resolves.toBe(false);
  });

  it('upsert: создаёт или обновляет mute-настройку', async () => {
    const mutedUntil = new Date('2026-08-23T12:00:00.000Z');
    prismaMock.chatMuteSettings.upsert.mockResolvedValue({
      chatId: 10,
      userId: 2,
      mutedUntil,
    });

    await repository.upsert(10, 2, mutedUntil);

    expect(prismaMock.chatMuteSettings.upsert).toHaveBeenCalledWith({
      where: { chatId_userId: { chatId: 10, userId: 2 } },
      create: { chatId: 10, userId: 2, mutedUntil },
      update: { mutedUntil },
    });
  });

  it('remove: удаляет mute-настройку', async () => {
    prismaMock.chatMuteSettings.deleteMany.mockResolvedValue({ count: 1 });

    await repository.remove(10, 2);

    expect(prismaMock.chatMuteSettings.deleteMany).toHaveBeenCalledWith({
      where: { chatId: 10, userId: 2 },
    });
  });
});
