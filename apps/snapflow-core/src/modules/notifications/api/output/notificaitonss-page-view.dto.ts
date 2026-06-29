import { CursorPaginatedViewDto } from '../../../../../../../libs/dto/cursor-paginated.view-dto';
import { NotificationViewDto } from './notification-view.dto';
import { ApiProperty } from '@nestjs/swagger';

export class NotificationsPageViewDto extends CursorPaginatedViewDto<NotificationViewDto> {
  @ApiProperty({ type: [NotificationViewDto] })
  declare items: NotificationViewDto[];
}
