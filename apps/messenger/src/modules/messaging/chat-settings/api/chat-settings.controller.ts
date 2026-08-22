import {
  Body,
  Controller,
  Delete,
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
import { MuteChatCommand } from '../../application/commands/mute-chat.command';
import { UnmuteChatCommand } from '../../application/commands/unmute-chat.command';
import { ChatMembershipGuard } from '../../sharing/api/guards/chat-membership.guard';
import { MuteChatInputDto } from '../../api/input-dto/mute-chat.input-dto';
import { MuteChatSwagger } from '../../api/swagger/mute-chat.swagger';
import { UnmuteChatSwagger } from '../../api/swagger/unmute-chat.swagger';

@ApiTags('Messenger')
@Controller('messenger')
@UseGuards(AccessTokenGuard)
export class ChatSettingsController {
  constructor(private readonly commandBus: CommandBus) {}

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
}
