import { SendMessageApplicationDto } from '../dto/send-message.application-dto';

export class SendMessageCommand {
  constructor(public readonly dto: SendMessageApplicationDto) {}
}
