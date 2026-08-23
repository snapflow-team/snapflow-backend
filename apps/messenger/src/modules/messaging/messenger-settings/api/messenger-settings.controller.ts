import { Body, Controller, HttpCode, HttpStatus, Patch, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';
import { ExtractUserFromRequest } from '../../../auth/guards/decorators/extract-user-from-request.decorator';
import { UserContextDto } from '../../../auth/guards/dto/user-context.dto';
import { AccessTokenGuard } from '../../../auth/guards/access-token.guard';
import { UpdateActivityStatusCommand } from '../../presence/application/commands/update-activity-status.command';
import { UpdateActivityStatusInputDto } from './input-dto/update-activity-status.input-dto';
import { UpdateActivityStatusSwagger } from './swagger/update-activity-status.swagger';

@ApiTags('Messenger: settings')
@Controller('messenger/settings')
@UseGuards(AccessTokenGuard)
export class MessengerSettingsController {
  constructor(private readonly commandBus: CommandBus) {}

  @Patch('activity-status')
  @UpdateActivityStatusSwagger()
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateActivityStatus(
    @Body() { showActivityStatus }: UpdateActivityStatusInputDto,
    @ExtractUserFromRequest() { id: userId }: UserContextDto,
  ): Promise<void> {
    await this.commandBus.execute(new UpdateActivityStatusCommand({ userId, showActivityStatus }));
  }
}
