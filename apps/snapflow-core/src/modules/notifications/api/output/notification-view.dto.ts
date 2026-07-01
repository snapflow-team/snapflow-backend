import { $Enums, Notification } from '@generated/prisma-snapflow';
import NotificationType = $Enums.NotificationType;

export class NotificationViewDto {
  id: string;
  userId: string;
  message: string;
  notificationType: NotificationType;
  isRead: boolean;
  createdAt: string;

  static mapToView(notification: Notification): NotificationViewDto {
    const dto = new NotificationViewDto();

    dto.id = notification.id.toString();
    dto.userId = notification.userId.toString();
    dto.message = notification.message;
    dto.notificationType = notification.type;
    dto.isRead = notification.isRead;
    dto.createdAt = notification.createdAt.toISOString();

    return dto;
  }
}
