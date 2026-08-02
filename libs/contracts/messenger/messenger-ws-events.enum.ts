export enum MessengerWsEvent {
  MessageNew = 'message.new',
  MessageUpdated = 'message.updated',
  MessageDeleted = 'message.deleted',
  MessageDelivered = 'message.delivered',
  MessageRead = 'message.read',
  ChatUpdated = 'chat.updated',
  TypingStart = 'typing.start',
  TypingStop = 'typing.stop',
  PresenceUpdated = 'presence.updated',
  PresenceHeartbeat = 'presence.heartbeat',
}
