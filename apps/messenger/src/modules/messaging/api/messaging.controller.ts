import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';
import { ExtractUserFromRequest } from '../../auth/guards/decorators/extract-user-from-request.decorator';
import { UserContextDto } from '../../auth/guards/dto/user-context.dto';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { SendMessageCommand } from '../application/usecases/send-message.usecase';
import { SendMessageInputDto } from './input-dto/send-message.input-dto';
import { SendMessageSwagger } from './swagger/send-message.swagger';
import { MessageViewDto } from './view-dto/message.view-dto';

@ApiTags('Messenger')
@Controller('messenger')
@UseGuards(AccessTokenGuard)
export class MessagingController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('messages')
  @SendMessageSwagger()
  async sendMessage(
    @Body() { receiverId, text }: SendMessageInputDto,
    @ExtractUserFromRequest() { id: senderId }: UserContextDto,
  ): Promise<MessageViewDto> {
    return this.commandBus.execute<SendMessageCommand, MessageViewDto>(
      new SendMessageCommand({ senderId, receiverId: Number(receiverId), text }),
    );
  }
}
