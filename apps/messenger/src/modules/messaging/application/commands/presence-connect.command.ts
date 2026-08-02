import { PresenceSocketApplicationDto } from '../dto/presence-socket.application-dto';

export class PresenceConnectCommand {
  constructor(public readonly dto: PresenceSocketApplicationDto) {}
}
