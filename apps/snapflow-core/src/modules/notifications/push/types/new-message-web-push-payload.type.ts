export type NewMessageWebPushPayload = {
  title: string;
  body: string;
  tag: string;
  data: {
    chatId: string;
    url: string;
    unreadTotal: number;
  };
};
