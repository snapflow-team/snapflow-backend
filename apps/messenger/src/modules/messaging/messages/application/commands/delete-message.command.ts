import { DeleteMessageApplicationDto } from '../dto/delete-message.application-dto';

export class DeleteMessageCommand {
  constructor(public readonly dto: DeleteMessageApplicationDto) {}
}
