import { PresenceSocketApplicationDto } from '../dto/presence-socket.application-dto';

export class PresenceDisconnectCommand {
  constructor(public readonly dto: PresenceSocketApplicationDto) {}
}
