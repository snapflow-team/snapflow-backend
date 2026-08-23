import { MuteChatApplicationDto } from '../dto/mute-chat.application-dto';

export class MuteChatCommand {
  constructor(public readonly dto: MuteChatApplicationDto) {}
}
