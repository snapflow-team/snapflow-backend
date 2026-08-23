import { Injectable } from '@nestjs/common';
import type { PresenceUpdatedPayload } from '@contracts/messenger';
import { MessengerWsEvent } from '@contracts/messenger';
import { PresenceRepository } from '../../infrastructure/presence.repository';
import { ChatsRepository } from '../../../chats/infrastructure/chats.repository';
import { MessengerWebSocketService } from '../../../realtime/services/messenger-websocket.service';
import { resolvesShowActivityStatus } from './presence-privacy.helper';

@Injectable()
export class PresenceBroadcastHelper {
  constructor(
    private readonly presenceRepository: PresenceRepository,
    private readonly chatsRepository: ChatsRepository,
    private readonly messengerWebSocketService: MessengerWebSocketService,
  ) {}

  /**
   * Рассылает presence.updated собеседникам, у которых включён показ активности.
   * Проверку собственной приватности актора выполняет вызывающий код.
   */
  async emitToPeersWhoShowActivity(
    actorUserId: number,
    payload: { online: boolean; lastSeenAt: string | null },
  ): Promise<void> {
    const peerIds: number[] = await this.chatsRepository.findPeerUserIds(actorUserId);
    if (peerIds.length === 0) {
      return;
    }

    const settingsMap = await this.presenceRepository.getSettingsMap(peerIds);
    const wsPayload: PresenceUpdatedPayload = {
      userId: String(actorUserId),
      online: payload.online,
      lastSeenAt: payload.lastSeenAt,
    };

    for (const peerId of peerIds) {
      if (!resolvesShowActivityStatus(settingsMap.get(peerId))) {
        continue;
      }

      this.messengerWebSocketService.emitToUser(
        peerId,
        MessengerWsEvent.PresenceUpdated,
        wsPayload,
      );
    }
  }
}
