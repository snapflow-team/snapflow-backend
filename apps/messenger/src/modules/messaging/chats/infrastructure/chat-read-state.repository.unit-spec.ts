import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../database/prisma.service';
import { ChatReadStateRepository } from './chat-read-state.repository';

describe('ChatReadStateRepository (unit)', () => {
  let repository: ChatReadStateRepository;
  let prismaMock: {
    chatReadState: { findUnique: jest.Mock; upsert: jest.Mock };
  };

  const createdAt = new Date('2026-07-05T18:00:00.000Z');

  beforeEach(async () => {
    prismaMock = {
      chatReadState: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatReadStateRepository, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    repository = module.get(ChatReadStateRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('findReadState: возвращает read state по chatId и userId', async () => {
    const readState = {
      id: 1,
      chatId: 10,
      userId: 1,
      lastReadMessageId: 100,
      lastReadAt: createdAt,
    };

    prismaMock.chatReadState.findUnique.mockResolvedValue(readState);

    await expect(repository.findReadState(10, 1)).resolves.toEqual(readState);
    expect(prismaMock.chatReadState.findUnique).toHaveBeenCalledWith({
      where: {
        chatId_userId: {
          chatId: 10,
          userId: 1,
        },
      },
    });
  });

  it('upsertReadState: создаёт или обновляет read state через переданный tx', async () => {
    const lastReadAt = new Date('2026-07-06T12:00:00.000Z');
    const readState = {
      id: 1,
      chatId: 10,
      userId: 1,
      lastReadMessageId: 100,
      lastReadAt,
    };
    const txMock = {
      chatReadState: {
        upsert: jest.fn().mockResolvedValue(readState),
      },
    };

    await expect(
      repository.upsertReadState(10, 1, 100, lastReadAt, txMock as never),
    ).resolves.toEqual(readState);

    expect(txMock.chatReadState.upsert).toHaveBeenCalledWith({
      where: {
        chatId_userId: {
          chatId: 10,
          userId: 1,
        },
      },
      create: {
        chatId: 10,
        userId: 1,
        lastReadMessageId: 100,
        lastReadAt,
      },
      update: {
        lastReadMessageId: 100,
        lastReadAt,
      },
    });
    expect(prismaMock.chatReadState.upsert).not.toHaveBeenCalled();
  });
});
