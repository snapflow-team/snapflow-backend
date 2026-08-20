import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';
import { ExtractUserFromRequest } from '../../auth/guards/decorators/extract-user-from-request.decorator';
import { UserContextDto } from '../../auth/guards/dto/user-context.dto';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { DeleteMessageCommand } from '../application/commands/delete-message.command';
import { EditMessageCommand } from '../application/commands/edit-message.command';
import { MuteChatCommand } from '../application/commands/mute-chat.command';
import { UnmuteChatCommand } from '../application/commands/unmute-chat.command';
import { UpdateActivityStatusCommand } from '../application/commands/update-activity-status.command';
import { GetChatMessagesQuery } from '../application/queries/get-chat-messages.query-handler';
import { GetPresenceQuery } from '../application/queries/get-presence.query-handler';
import { GetUserChatsQuery } from '../application/queries/get-user-chats.query-handler';
import { GetOrCreateChatCommand } from '../application/usecases/get-or-create-chat.usecase';
import { MarkChatReadCommand } from '../application/usecases/mark-chat-read.usecase';
import { SendMessageCommand } from '../application/usecases/send-message.usecase';
import { ChatMembershipGuard } from './guards/chat-membership.guard';
import { DeleteMessageQueryDto } from './input-dto/delete-message.query-dto';
import { EditMessageInputDto } from './input-dto/edit-message.input-dto';
import { GetChatMessagesQueryParamsDto } from './input-dto/get-chat-messages.query-params.dto';
import { GetOrCreateChatInputDto } from './input-dto/get-or-create-chat.input-dto';
import { GetPresenceQueryParamsDto } from './input-dto/get-presence.query-params.dto';
import { GetUserChatsQueryParamsDto } from './input-dto/get-user-chats.query-params.dto';
import { MarkChatReadInputDto } from './input-dto/mark-chat-read.input-dto';
import { MuteChatInputDto } from './input-dto/mute-chat.input-dto';
import { SendMessageInputDto } from './input-dto/send-message.input-dto';
import { UpdateActivityStatusInputDto } from './input-dto/update-activity-status.input-dto';
import { DeleteMessageSwagger } from './swagger/delete-message.swagger';
import { EditMessageSwagger } from './swagger/edit-message.swagger';
import { GetChatMessagesSwagger } from './swagger/get-chat-messages.swagger';
import { GetOrCreateChatSwagger } from './swagger/get-or-create-chat.swagger';
import { GetPresenceSwagger } from './swagger/get-presence.swagger';
import { GetUserChatsSwagger } from './swagger/get-user-chats.swagger';
import { MarkChatReadSwagger } from './swagger/mark-chat-read.swagger';
import { MuteChatSwagger } from './swagger/mute-chat.swagger';
import { SendMessageSwagger } from './swagger/send-message.swagger';
import { UnmuteChatSwagger } from './swagger/unmute-chat.swagger';
import { UpdateActivityStatusSwagger } from './swagger/update-activity-status.swagger';
import { ChatMessagesPageViewDto } from './view-dto/chat-messages-page.view-dto';
import { ChatViewDto } from './view-dto/chat.view-dto';
import { MessageViewDto } from './view-dto/message.view-dto';
import { PresenceViewDto } from './view-dto/presence.view-dto';
import { UserChatsPageViewDto } from './view-dto/user-chats-page.view-dto';

@ApiTags('Messenger')
@Controller('messenger')
@UseGuards(AccessTokenGuard)
export class MessagingController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get('presence')
  @GetPresenceSwagger()
  async getPresence(
    @Query() query: GetPresenceQueryParamsDto,
    @ExtractUserFromRequest() { id: userId }: UserContextDto,
  ): Promise<PresenceViewDto[]> {
    return this.queryBus.execute<GetPresenceQuery, PresenceViewDto[]>(
      new GetPresenceQuery(userId, query.userIds),
    );
  }

  @Patch('settings/activity-status')
  @UpdateActivityStatusSwagger()
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateActivityStatus(
    @Body() { showActivityStatus }: UpdateActivityStatusInputDto,
    @ExtractUserFromRequest() { id: userId }: UserContextDto,
  ): Promise<void> {
    await this.commandBus.execute(new UpdateActivityStatusCommand({ userId, showActivityStatus }));
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

  @Get('chats/:chatId/messages')
  @GetChatMessagesSwagger()
  @UseGuards(ChatMembershipGuard)
  async getChatMessages(
    @Param('chatId', ParseIntPipe) chatId: number,
    @Query() query: GetChatMessagesQueryParamsDto,
    @ExtractUserFromRequest() { id: userId }: UserContextDto,
  ): Promise<ChatMessagesPageViewDto> {
    return this.queryBus.execute<GetChatMessagesQuery, ChatMessagesPageViewDto>(
      new GetChatMessagesQuery(chatId, userId, query),
    );
  }

  @Post('chats/:chatId/read')
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

  @Post('chats/:chatId/mute')
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

  @Delete('chats/:chatId/mute')
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

  @Post('messages')
  @SendMessageSwagger()
  async sendMessage(
    @Body() { receiverId, text, clientMessageId, replyToMessageId }: SendMessageInputDto,
    @ExtractUserFromRequest() { id: senderId }: UserContextDto,
  ): Promise<MessageViewDto> {
    return this.commandBus.execute<SendMessageCommand, MessageViewDto>(
      new SendMessageCommand({
        senderId,
        receiverId: Number(receiverId),
        text,
        clientMessageId,
        ...(replyToMessageId !== undefined ? { replyToMessageId: Number(replyToMessageId) } : {}),
      }),
    );
  }

  @Patch('messages/:messageId')
  @EditMessageSwagger()
  @UseGuards(ChatMembershipGuard)
  async editMessage(
    @Param('messageId', ParseIntPipe) messageId: number,
    @Body() { text }: EditMessageInputDto,
    @ExtractUserFromRequest() { id: editorId }: UserContextDto,
  ): Promise<MessageViewDto> {
    return this.commandBus.execute<EditMessageCommand, MessageViewDto>(
      new EditMessageCommand({
        messageId,
        editorId,
        text,
      }),
    );
  }

  @Delete('messages/:messageId')
  @DeleteMessageSwagger()
  @UseGuards(ChatMembershipGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMessage(
    @Param('messageId', ParseIntPipe) messageId: number,
    @Query() { scope }: DeleteMessageQueryDto,
    @ExtractUserFromRequest() { id: userId }: UserContextDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new DeleteMessageCommand({
        messageId,
        userId,
        scope,
      }),
    );
  }
}
