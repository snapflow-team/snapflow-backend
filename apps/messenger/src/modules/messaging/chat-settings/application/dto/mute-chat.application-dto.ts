export class MuteChatApplicationDto {
  chatId: number;
  userId: number;
  mutedUntil: Date | null;
}
