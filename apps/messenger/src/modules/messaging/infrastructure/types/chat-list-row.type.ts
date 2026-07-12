export type ChatListRow = {
  id: number;
  participant_a_id: number;
  participant_b_id: number;
  last_message_id: number | null;
  last_message_at: Date | null;
  created_at: Date;
  updated_at: Date;
  lm_id: number | null;
  lm_chat_id: number | null;
  lm_sender_id: number | null;
  lm_text: string | null;
  lm_created_at: Date | null;
  unread_count: number;
};
