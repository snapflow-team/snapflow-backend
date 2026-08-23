import { UnmuteChatApplicationDto } from '../dto/unmute-chat.application-dto';

export class UnmuteChatCommand {
  constructor(public readonly dto: UnmuteChatApplicationDto) {}
}
