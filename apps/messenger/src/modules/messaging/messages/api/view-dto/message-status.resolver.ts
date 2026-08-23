export type MessageDeliveryStatus = 'sent' | 'delivered' | 'read';

export type MessageStatusContext = {
  viewerId?: number;
  peerLastReadMessageId?: number | null;
  deliveredToPeer?: boolean;
};

export function resolveMessageStatus(
  messageId: number,
  senderId: number,
  context: MessageStatusContext,
): MessageDeliveryStatus | null {
  if (context.viewerId === undefined || context.viewerId !== senderId) {
    return null;
  }

  if (context.peerLastReadMessageId != null && context.peerLastReadMessageId >= messageId) {
    return 'read';
  }

  if (context.deliveredToPeer) {
    return 'delivered';
  }

  return 'sent';
}
