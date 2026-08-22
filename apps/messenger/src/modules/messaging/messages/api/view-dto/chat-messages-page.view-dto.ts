import { ApiProperty } from '@nestjs/swagger';
import { CursorPaginatedViewDto } from '../../../../../../../../libs/dto/cursor-paginated.view-dto';
import { MessageViewDto } from '../../../sharing/api/view-dto/message.view-dto';

export class ChatMessagesPageViewDto extends CursorPaginatedViewDto<MessageViewDto> {
  @ApiProperty({ type: [MessageViewDto] })
  declare items: MessageViewDto[];
}
