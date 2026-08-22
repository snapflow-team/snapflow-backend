import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';
import { ExtractUserFromRequest } from '../../../auth/guards/decorators/extract-user-from-request.decorator';
import { UserContextDto } from '../../../auth/guards/dto/user-context.dto';
import { AccessTokenGuard } from '../../../auth/guards/access-token.guard';
import { ChatMembershipGuard } from '../../sharing/api/guards/chat-membership.guard';
import { MarkChatReadCommand } from '../application/usecases/mark-chat-read.usecase';
import { MarkChatReadInputDto } from './input-dto/mark-chat-read.input-dto';
import { MarkChatReadSwagger } from './swagger/mark-chat-read.swagger';

@ApiTags('Messenger')
@Controller('messenger')
@UseGuards(AccessTokenGuard)
export class ReadStateController {
  constructor(private readonly commandBus: CommandBus) {}

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
}
