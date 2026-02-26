import { Body, Controller, HttpCode, HttpStatus, Put, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '../../../auth/domain/guards/bearer/jwt-auth.guard';
import { ExtractUserFromRequest } from '../../../auth/domain/guards/decorators/extract-user-from-request.decorator';
import { UserContextDto } from '../../../auth/domain/guards/dto/user-context.dto';
import { UpdateProfileInputDto } from './dto/input-dto/update-profile.input-dto';
import { UpdateProfileCommand } from '../application/usecases/update-profile.usecase';

@UseGuards(JwtAuthGuard)
@Controller('users/profile')
export class ProfileController {
  constructor(private readonly commandBus: CommandBus) {}

  @Put()
  @HttpCode(HttpStatus.NO_CONTENT)
  async fillProfile(
    @Body() body: UpdateProfileInputDto,
    @ExtractUserFromRequest() user: UserContextDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new UpdateProfileCommand({
        userId: user.id,
        ...body,
      }),
    );
  }
}
