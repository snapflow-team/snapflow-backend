import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';
import { ExtractUserFromRequest } from '../../../auth/guards/decorators/extract-user-from-request.decorator';
import { UserContextDto } from '../../../auth/guards/dto/user-context.dto';
import { AccessTokenGuard } from '../../../auth/guards/access-token.guard';
import { GetUnreadTotalQuery } from '../../application/queries/get-unread-total.query-handler';
import { GetUserChatsQuery } from '../../application/queries/get-user-chats.query-handler';
import { GetOrCreateChatCommand } from '../../application/usecases/get-or-create-chat.usecase';
import { GetOrCreateChatInputDto } from '../../api/input-dto/get-or-create-chat.input-dto';
import { GetUserChatsQueryParamsDto } from '../../api/input-dto/get-user-chats.query-params.dto';
import { GetOrCreateChatSwagger } from '../../api/swagger/get-or-create-chat.swagger';
import { GetUnreadCountSwagger } from '../../api/swagger/get-unread-count.swagger';
import { GetUserChatsSwagger } from '../../api/swagger/get-user-chats.swagger';
import { ChatViewDto } from '../../api/view-dto/chat.view-dto';
import { UnreadCountViewDto } from '../../api/view-dto/unread-count.view-dto';
import { UserChatsPageViewDto } from '../../api/view-dto/user-chats-page.view-dto';

@ApiTags('Messenger')
@Controller('messenger')
@UseGuards(AccessTokenGuard)
export class ChatsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get('unread-count')
  @GetUnreadCountSwagger()
  async getUnreadCount(
    @ExtractUserFromRequest() { id: userId }: UserContextDto,
  ): Promise<UnreadCountViewDto> {
    return this.queryBus.execute<GetUnreadTotalQuery, UnreadCountViewDto>(
      new GetUnreadTotalQuery(userId),
    );
  }

  @Get('chats')
  @GetUserChatsSwagger()
  async getUserChats(
    @Query() query: GetUserChatsQueryParamsDto,
    @ExtractUserFromRequest() { id: userId }: UserContextDto,
  ): Promise<UserChatsPageViewDto> {
    return this.queryBus.execute<GetUserChatsQuery, UserChatsPageViewDto>(
      new GetUserChatsQuery(userId, query),
    );
  }

  @Post('chats')
  @GetOrCreateChatSwagger()
  @HttpCode(HttpStatus.OK)
  async getOrCreateChat(
    @Body() { interlocutorId }: GetOrCreateChatInputDto,
    @ExtractUserFromRequest() { id: userId }: UserContextDto,
  ): Promise<ChatViewDto> {
    return this.commandBus.execute<GetOrCreateChatCommand, ChatViewDto>(
      new GetOrCreateChatCommand({ userId, interlocutorId: Number(interlocutorId) }),
    );
  }
}
