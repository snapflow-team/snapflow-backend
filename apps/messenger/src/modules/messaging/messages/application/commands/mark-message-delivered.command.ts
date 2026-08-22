import { MarkMessageDeliveredApplicationDto } from '../dto/mark-message-delivered.application-dto';

export class MarkMessageDeliveredCommand {
  constructor(public readonly dto: MarkMessageDeliveredApplicationDto) {}
}
