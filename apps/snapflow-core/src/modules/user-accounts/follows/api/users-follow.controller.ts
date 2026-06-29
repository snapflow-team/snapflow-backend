import {
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
import { ExtractUserFromRequest } from '../../auth/domain/guards/decorators/extract-user-from-request.decorator';
import { UserContextDto } from '../../auth/domain/guards/dto/user-context.dto';
import { JwtAuthGuard } from '../../auth/domain/guards/bearer/jwt-auth.guard';
import { FollowUserCommand } from '../application/usecases/follow-user.usecase';
import { UnfollowUserCommand } from '../application/usecases/unfollow-user.usecase';
import { FollowUserSwagger } from './swagger/follow-user.swagger';
import { UnfollowUserSwagger } from './swagger/unfollow-user.swagger';

@ApiTags('Follows')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersFollowController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':userId/follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  @FollowUserSwagger()
  async followUser(
    @Param('userId', ParseIntPipe) targetUserId: number,
    @ExtractUserFromRequest() { id: followerId }: UserContextDto,
  ): Promise<void> {
    await this.commandBus.execute(new FollowUserCommand(followerId, targetUserId));
  }

  @Delete(':userId/follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UnfollowUserSwagger()
  async unfollowUser(
    @Param('userId', ParseIntPipe) targetUserId: number,
    @ExtractUserFromRequest() { id: followerId }: UserContextDto,
  ): Promise<void> {
    await this.commandBus.execute(new UnfollowUserCommand(followerId, targetUserId));
  }
}
