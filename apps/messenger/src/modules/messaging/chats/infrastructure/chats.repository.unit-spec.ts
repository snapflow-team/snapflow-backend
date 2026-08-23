import { Test, TestingModule } from '@nestjs/testing';
import { Chat } from '@generated/prisma-messenger';
import { PrismaService } from '../../../database/prisma.service';
import { ChatsRepository } from './chats.repository';

describe('ChatsRepository (unit)', () => {
  let repository: ChatsRepository;
  let prismaMock: {
    chat: { findUnique: jest.Mock; upsert: jest.Mock; update: jest.Mock; findMany: jest.Mock };
  };

  const createdAt = new Date('2026-07-05T18:00:00.000Z');

  beforeEach(async () => {
    prismaMock = {
      chat: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatsRepository, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    repository = module.get(ChatsRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('getOrCreate: нормализует участников и вызывает upsert', async () => {
    const chat: Chat = {
      id: 5,
      participantAId: 2,
      participantBId: 7,
      lastMessageId: null,
      lastMessageAt: null,
      createdAt,
      updatedAt: createdAt,
    };

    prismaMock.chat.upsert.mockResolvedValue(chat);

    await expect(repository.getOrCreate(7, 2)).resolves.toEqual(chat);
    expect(prismaMock.chat.upsert).toHaveBeenCalledWith({
      where: {
        participantAId_participantBId: {
          participantAId: 2,
          participantBId: 7,
        },
      },
      create: {
        participantAId: 2,
        participantBId: 7,
      },
      update: {},
    });
  });

  it('getInterlocutorId: возвращает второго участника чата', () => {
    const chat: Pick<Chat, 'participantAId' | 'participantBId'> = {
      participantAId: 1,
      participantBId: 5,
    };

    expect(repository.getInterlocutorId(chat, 1)).toBe(5);
    expect(repository.getInterlocutorId(chat, 5)).toBe(1);
  });

  it('updateLastMessage: обновляет lastMessage* чата через переданный tx', async () => {
    const lastMessageAt = new Date('2026-07-06T12:00:00.000Z');
    const txMock = {
      chat: {
        update: jest.fn().mockResolvedValue({}),
      },
    };

    await repository.updateLastMessage(10, 100, lastMessageAt, txMock as never);

    expect(txMock.chat.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: {
        lastMessageId: 100,
        lastMessageAt,
      },
    });
    expect(prismaMock.chat.update).not.toHaveBeenCalled();
  });

  it('findById: возвращает чат по id', async () => {
    const chat: Chat = {
      id: 7,
      participantAId: 1,
      participantBId: 2,
      lastMessageId: null,
      lastMessageAt: null,
      createdAt,
      updatedAt: createdAt,
    };

    prismaMock.chat.findUnique.mockResolvedValue(chat);

    await expect(repository.findById(7)).resolves.toEqual(chat);
    expect(prismaMock.chat.findUnique).toHaveBeenCalledWith({ where: { id: 7 } });
  });

  it('findPeerUserIds: возвращает distinct собеседников по всем чатам', async () => {
    prismaMock.chat.findMany.mockResolvedValue([
      { participantAId: 1, participantBId: 2 },
      { participantAId: 3, participantBId: 1 },
      { participantAId: 1, participantBId: 2 },
    ]);

    await expect(repository.findPeerUserIds(1)).resolves.toEqual([2, 3]);
    expect(prismaMock.chat.findMany).toHaveBeenCalledWith({
      where: {
        OR: [{ participantAId: 1 }, { participantBId: 1 }],
      },
      select: {
        participantAId: true,
        participantBId: true,
      },
    });
  });
});
