import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';
import { ExtractUserFromRequest } from '../../../auth/guards/decorators/extract-user-from-request.decorator';
import { UserContextDto } from '../../../auth/guards/dto/user-context.dto';
import { AccessTokenGuard } from '../../../auth/guards/access-token.guard';
import { GetOrCreateChatCommand } from '../application/commands/get-or-create-chat.command';
import { MuteChatCommand } from '../application/commands/mute-chat.command';
import { UnmuteChatCommand } from '../application/commands/unmute-chat.command';
import { MarkChatReadCommand } from '../application/commands/mark-chat-read.command';
import { GetUnreadTotalQuery } from '../application/queries/get-unread-total.query-handler';
import { GetUserChatsQuery } from '../application/queries/get-user-chats.query-handler';
import { ChatMembershipGuard } from './guards/chat-membership.guard';
import { GetOrCreateChatInputDto } from './input-dto/get-or-create-chat.input-dto';
import { GetUserChatsQueryParamsDto } from './input-dto/get-user-chats.query-params.dto';
import { MarkChatReadInputDto } from './input-dto/mark-chat-read.input-dto';
import { MuteChatInputDto } from './input-dto/mute-chat.input-dto';
import { GetOrCreateChatSwagger } from './swagger/get-or-create-chat.swagger';
import { GetUnreadCountSwagger } from './swagger/get-unread-count.swagger';
import { GetUserChatsSwagger } from './swagger/get-user-chats.swagger';
import { MarkChatReadSwagger } from './swagger/mark-chat-read.swagger';
import { MuteChatSwagger } from './swagger/mute-chat.swagger';
import { UnmuteChatSwagger } from './swagger/unmute-chat.swagger';
import { ChatViewDto } from './view-dto/chat.view-dto';
import { UnreadCountViewDto } from './view-dto/unread-count.view-dto';
import { UserChatsPageViewDto } from './view-dto/user-chats-page.view-dto';

@ApiTags('Messenger: chats')
@Controller('messenger/chats')
@UseGuards(AccessTokenGuard)
export class ChatsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
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

  @Get()
  @GetUserChatsSwagger()
  async getUserChats(
    @Query() query: GetUserChatsQueryParamsDto,
    @ExtractUserFromRequest() { id: userId }: UserContextDto,
  ): Promise<UserChatsPageViewDto> {
    return this.queryBus.execute<GetUserChatsQuery, UserChatsPageViewDto>(
      new GetUserChatsQuery(userId, query),
    );
  }

  @Get('unread-count')
  @GetUnreadCountSwagger()
  async getUnreadCount(
    @ExtractUserFromRequest() { id: userId }: UserContextDto,
  ): Promise<UnreadCountViewDto> {
    return this.queryBus.execute<GetUnreadTotalQuery, UnreadCountViewDto>(
      new GetUnreadTotalQuery(userId),
    );
  }

  @Post(':chatId/mute')
  @MuteChatSwagger()
  @UseGuards(ChatMembershipGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async muteChat(
    @Param('chatId', ParseIntPipe) chatId: number,
    @Body() dto: MuteChatInputDto,
    @ExtractUserFromRequest() { id: userId }: UserContextDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new MuteChatCommand({
        chatId,
        userId,
        mutedUntil: dto.mutedUntil ? new Date(dto.mutedUntil) : null,
      }),
    );
  }

  @Delete(':chatId/mute')
  @UnmuteChatSwagger()
  @UseGuards(ChatMembershipGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async unmuteChat(
    @Param('chatId', ParseIntPipe) chatId: number,
    @ExtractUserFromRequest() { id: userId }: UserContextDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new UnmuteChatCommand({
        chatId,
        userId,
      }),
    );
  }

  @Post(':chatId/read')
  @MarkChatReadSwagger()
  @UseGuards(ChatMembershipGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async markChatRead(
    @Param('chatId', ParseIntPipe) chatId: number,
    @Body() { lastReadMessageId }: MarkChatReadInputDto,
    @ExtractUserFromRequest() { id: readerId }: UserContextDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new MarkChatReadCommand({
        chatId,
        readerId,
        lastReadMessageId: Number(lastReadMessageId),
      }),
    );
  }
}
