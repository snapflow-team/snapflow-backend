import { GetOrCreateChatApplicationDto } from '../dto/get-or-create-chat.application-dto';

export class GetOrCreateChatCommand {
  constructor(public readonly dto: GetOrCreateChatApplicationDto) {}
}
