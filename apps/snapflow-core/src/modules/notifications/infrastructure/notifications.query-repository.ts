import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { GetNotificationsQueryParamsDto } from '../api/input/get-notifications-query-params.dto';
import { NotificationsPageViewDto } from '../api/output/notificaitonss-page-view.dto';
import {
  buildCursorPaginatedResult,
  buildKeysetCursorFilter,
  getKeysetTake,
  KEYSET_ORDER_BY_CREATED_AT_DESC,
} from '../../../../../../libs/common/utils/cursor-pagination.util';
import { CursorPayload, decodeCursor } from '../../../../../../libs/common/utils/cursor.util';
import { NotificationViewDto } from '../api/output/notification-view.dto';
import { Prisma } from '@generated/prisma-snapflow';
import { UnreadNotificationsCountViewDto } from '../api/output/unread-notifications-count.view-dto';

@Injectable()
export class NotificationsQueryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findNotifications(
    userId: number,
    query: GetNotificationsQueryParamsDto,
  ): Promise<NotificationsPageViewDto> {
    const cursorPayload: CursorPayload | undefined = query.cursor
      ? decodeCursor(query.cursor)
      : undefined;

    const where = {
      userId,
      deletedAt: null,
      ...(cursorPayload
        ? (buildKeysetCursorFilter(cursorPayload, {
            parseId: Number,
          }) as Prisma.NotificationWhereInput)
        : {}),
    };

    const notifications = await this.prisma.notification.findMany({
      where,
      orderBy: [...KEYSET_ORDER_BY_CREATED_AT_DESC],
      take: getKeysetTake(query.limit),
    });

    return buildCursorPaginatedResult<NotificationViewDto>(
      notifications.map(NotificationViewDto.mapToView),
      query.limit,
      (item: NotificationViewDto) => {
        return {
          createdAt: item.createdAt,
          id: item.id,
        };
      },
    );
  }
  async getUnreadCount(userId: number): Promise<UnreadNotificationsCountViewDto> {
    const unreadCount = await this.prisma.notification.count({
      where: {
        userId,
        deletedAt: null,
        isRead: false,
      },
    });
    return UnreadNotificationsCountViewDto.mapToView(unreadCount);
  }
}
