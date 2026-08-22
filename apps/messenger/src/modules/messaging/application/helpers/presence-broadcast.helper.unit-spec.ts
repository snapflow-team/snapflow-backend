import { Test, TestingModule } from '@nestjs/testing';
import { MessengerWsEvent } from '@contracts/messenger';
import { PresenceBroadcastHelper } from '../helpers/presence-broadcast.helper';
import { PresenceRepository } from '../../infrastructure/presence.repository';
import { ChatsRepository } from '../../infrastructure/chats.repository';
import { MessengerWebSocketService } from '../../websocket/services/messenger-websocket.service';

describe('PresenceBroadcastHelper (unit)', () => {
  let helper: PresenceBroadcastHelper;
  let presenceRepositoryMock: jest.Mocked<Pick<PresenceRepository, 'getSettingsMap'>>;
  let chatsRepositoryMock: jest.Mocked<Pick<ChatsRepository, 'findPeerUserIds'>>;
  let messengerWebSocketServiceMock: jest.Mocked<Pick<MessengerWebSocketService, 'emitToUser'>>;

  beforeEach(async () => {
    presenceRepositoryMock = {
      getSettingsMap: jest.fn().mockResolvedValue(
        new Map([
          [2, { userId: 2, showActivityStatus: true, lastSeenAt: null, updatedAt: new Date() }],
          [3, { userId: 3, showActivityStatus: false, lastSeenAt: null, updatedAt: new Date() }],
        ]),
      ),
    };
    chatsRepositoryMock = {
      findPeerUserIds: jest.fn().mockResolvedValue([2, 3]),
    };
    messengerWebSocketServiceMock = {
      emitToUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PresenceBroadcastHelper,
        { provide: PresenceRepository, useValue: presenceRepositoryMock },
        { provide: ChatsRepository, useValue: chatsRepositoryMock },
        { provide: MessengerWebSocketService, useValue: messengerWebSocketServiceMock },
      ],
    }).compile();

    helper = module.get(PresenceBroadcastHelper);
  });

  it('эмитит только peers с showActivityStatus=true', async () => {
    await helper.emitToPeersWhoShowActivity(1, { online: true, lastSeenAt: null });

    expect(messengerWebSocketServiceMock.emitToUser).toHaveBeenCalledTimes(1);
    expect(messengerWebSocketServiceMock.emitToUser).toHaveBeenCalledWith(
      2,
      MessengerWsEvent.PresenceUpdated,
      { userId: '1', online: true, lastSeenAt: null },
    );
  });

  it('не эмитит, если peers нет', async () => {
    chatsRepositoryMock.findPeerUserIds.mockResolvedValue([]);

    await helper.emitToPeersWhoShowActivity(1, { online: false, lastSeenAt: null });

    expect(presenceRepositoryMock.getSettingsMap).not.toHaveBeenCalled();
    expect(messengerWebSocketServiceMock.emitToUser).not.toHaveBeenCalled();
  });
});
