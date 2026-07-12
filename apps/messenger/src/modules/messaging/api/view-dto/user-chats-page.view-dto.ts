import { ApiProperty } from '@nestjs/swagger';
import { CursorPaginatedViewDto } from '../../../../../../../libs/dto/cursor-paginated.view-dto';
import { ChatListItemViewDto } from './chat-list-item.view-dto';

export class UserChatsPageViewDto extends CursorPaginatedViewDto<ChatListItemViewDto> {
  @ApiProperty({ type: [ChatListItemViewDto] })
  declare items: ChatListItemViewDto[];
}
