import { DeleteMessageScope } from '../../api/input-dto/delete-message.query-dto';

export class DeleteMessageApplicationDto {
  messageId: number;
  userId: number;
  scope: DeleteMessageScope;
}
