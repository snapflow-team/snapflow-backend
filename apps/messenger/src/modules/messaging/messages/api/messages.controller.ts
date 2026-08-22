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
import { ExtractUserFromRequest } from '../../../auth/guards/decorators/extract-user-from-request.decorator';
import { UserContextDto } from '../../../auth/guards/dto/user-context.dto';
import { AccessTokenGuard } from '../../../auth/guards/access-token.guard';
import { DeleteMessageCommand } from '../../application/commands/delete-message.command';
import { EditMessageCommand } from '../../application/commands/edit-message.command';
import { GetChatMessagesQuery } from '../../application/queries/get-chat-messages.query-handler';
import { SendMessageCommand } from '../../application/usecases/send-message.usecase';
import { ChatMembershipGuard } from '../../sharing/api/guards/chat-membership.guard';
import { DeleteMessageQueryDto } from '../../api/input-dto/delete-message.query-dto';
import { EditMessageInputDto } from '../../api/input-dto/edit-message.input-dto';
import { GetChatMessagesQueryParamsDto } from '../../api/input-dto/get-chat-messages.query-params.dto';
import { SendMessageInputDto } from '../../api/input-dto/send-message.input-dto';
import { DeleteMessageSwagger } from '../../api/swagger/delete-message.swagger';
import { EditMessageSwagger } from '../../api/swagger/edit-message.swagger';
import { GetChatMessagesSwagger } from '../../api/swagger/get-chat-messages.swagger';
import { SendMessageSwagger } from '../../api/swagger/send-message.swagger';
import { ChatMessagesPageViewDto } from '../../api/view-dto/chat-messages-page.view-dto';
import { MessageViewDto } from '../../sharing/api/view-dto/message.view-dto';

@ApiTags('Messenger')
@Controller('messenger')
@UseGuards(AccessTokenGuard)
export class MessagesController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

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
