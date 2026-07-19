export class SendMessageApplicationDto {
  senderId: number;
  receiverId: number;
  text: string;
  clientMessageId: string;
  replyToMessageId?: number;
}
