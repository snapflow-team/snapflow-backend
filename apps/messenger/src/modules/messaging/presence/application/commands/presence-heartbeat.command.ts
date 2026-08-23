import { PresenceSocketApplicationDto } from '../dto/presence-socket.application-dto';

export class PresenceHeartbeatCommand {
  constructor(public readonly dto: PresenceSocketApplicationDto) {}
}
