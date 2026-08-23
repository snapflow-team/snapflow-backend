import { MarkChatReadApplicationDto } from '../dto/mark-chat-read.application-dto';

export class MarkChatReadCommand {
  constructor(public readonly dto: MarkChatReadApplicationDto) {}
}
