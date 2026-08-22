import { Test, TestingModule } from '@nestjs/testing';
import { ChatsQueryRepository } from '../../infrastructure/query/chats.query-repository';
import { GetUnreadTotalQuery, GetUnreadTotalQueryHandler } from './get-unread-total.query-handler';

describe('GetUnreadTotalQueryHandler (unit)', () => {
  let handler: GetUnreadTotalQueryHandler;
  let chatsQueryRepositoryMock: jest.Mocked<Pick<ChatsQueryRepository, 'getTotalUnreadCount'>>;

  beforeEach(async () => {
    chatsQueryRepositoryMock = {
      getTotalUnreadCount: jest.fn().mockResolvedValue(5),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetUnreadTotalQueryHandler,
        { provide: ChatsQueryRepository, useValue: chatsQueryRepositoryMock },
      ],
    }).compile();

    handler = module.get(GetUnreadTotalQueryHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('должен вернуть { total } из getTotalUnreadCount', async () => {
    await expect(handler.execute(new GetUnreadTotalQuery(42))).resolves.toEqual({ total: 5 });
    expect(chatsQueryRepositoryMock.getTotalUnreadCount).toHaveBeenCalledWith(42);
  });
});
