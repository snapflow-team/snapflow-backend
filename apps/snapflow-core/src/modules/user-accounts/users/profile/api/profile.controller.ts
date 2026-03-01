import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '../../../auth/domain/guards/bearer/jwt-auth.guard';
import { ExtractUserFromRequest } from '../../../auth/domain/guards/decorators/extract-user-from-request.decorator';
import { UserContextDto } from '../../../auth/domain/guards/dto/user-context.dto';
import { UpdateProfileInputDto } from './dto/input-dto/update-profile.input-dto';
import { UpdateProfileCommand } from '../application/usecases/update-profile.usecase';
import { ProfileViewDto } from './dto/view-dto/profile.view-dto';
import { GetProfileQuery } from '../application/queries/get-profile.query-handler';
import { Public } from '../../../decorators/public.decorator';
import { ApiTags } from '@nestjs/swagger';
import { ApiUpdateProfile } from './swagger/update-profile.swagger';
import { ApiGetProfile } from './swagger/get-profile.swagger';

@ApiTags('Profile')
@UseGuards(JwtAuthGuard)
@Controller('users/profile')
export class ProfileController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Put()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiUpdateProfile()
  async updateProfile(
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

  @Get(':userId')
  @Public()
  @ApiGetProfile()
  async getProfile(@Param('userId', ParseIntPipe) userId: number): Promise<ProfileViewDto> {
    return await this.queryBus.execute(new GetProfileQuery(userId));
  }
}
