import { EditMessageApplicationDto } from '../dto/edit-message.application-dto';

export class EditMessageCommand {
  constructor(public readonly dto: EditMessageApplicationDto) {}
}
