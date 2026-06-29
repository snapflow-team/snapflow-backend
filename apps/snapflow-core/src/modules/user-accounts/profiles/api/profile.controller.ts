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
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '../../auth/domain/guards/bearer/jwt-auth.guard';
import { ExtractUserFromRequest } from '../../auth/domain/guards/decorators/extract-user-from-request.decorator';
import { UserContextDto } from '../../auth/domain/guards/dto/user-context.dto';
import { UpdateProfileInputDto } from './dto/input-dto/update-profile.input-dto';
import { UpdateProfileCommand } from '../application/usecases/update-profile.usecase';
import { ProfileViewDto } from './dto/view-dto/profile.view-dto';
import { GetProfileQuery } from '../application/queries/get-profile.query-handler';
import { ApiTags } from '@nestjs/swagger';
import { ApiUpdateProfile } from './swagger/update-profile.swagger';
import { ApiGetProfile } from './swagger/get-profile.swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { AvatarFile } from '../pipes/avatar-file.pipe';
import { UploadAvatarApplicationDto } from '../application/dto/apload-avatar.application-dto';
import { AvatarViewDto } from './dto/view-dto/acatar.view-dto';
import { UploadAvatarCommand } from '../application/usecases/upload-avatar.usecase';
import { ApiUploadAvatar } from './swagger/upload-avatar.swagger';
import { DeleteAvatarCommand } from '../application/usecases/delete-avatar.usecase';
import { ApiDeleteAvatar } from './swagger/delete-avatar.swagger';
import { Public } from '../../sharing/decorators/public.decorator';
import { OptionalAuth } from '../../sharing/decorators/optional-auth.decorator';
import { ExtractOptionalUserFromRequest } from '../../auth/domain/guards/decorators/extract-optional-user-from-request.decorator';
import { PublicProfileViewDto } from './dto/view-dto/public-profile.view-dto';
import { GetPublicProfileQuery } from '../application/queries/get-public-profile.query-handler';
import { ApiGetPublicProfile } from './swagger/get-public-profile.swagger';
import { ProfileFollowListQueryParamsDto } from './dto/input-dto/profile-follow-list.query-params.dto';
import { ProfileFollowListPageViewDto } from './dto/view-dto/profile-follow-list-page.view-dto';
import { ApiGetProfileFollowing } from './swagger/get-profile-following.swagger';
import { ApiGetProfileFollowers } from './swagger/get-profile-followers.swagger';
import { GetProfileFollowingQuery } from '../application/queries/get-profile-following.query-handler';
import { GetProfileFollowersQuery } from '../application/queries/get-profile-followers.query-handler';

@ApiTags('Profile')
@UseGuards(JwtAuthGuard)
@Controller('users/profile')
export class ProfileController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  // Profile -------------------------------------
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

  @Get()
  @ApiGetProfile()
  async getProfile(
    @ExtractUserFromRequest() { id: userId }: UserContextDto,
  ): Promise<ProfileViewDto> {
    return await this.queryBus.execute(new GetProfileQuery(userId));
  }

  @Get(':profileId/following')
  @ApiGetProfileFollowing()
  async getProfileFollowing(
    @Param('profileId', ParseIntPipe) profileId: number,
    @Query() query: ProfileFollowListQueryParamsDto,
    @ExtractUserFromRequest() { id: viewerUserId }: UserContextDto,
  ): Promise<ProfileFollowListPageViewDto> {
    return this.queryBus.execute(new GetProfileFollowingQuery(profileId, query, viewerUserId));
  }

  @Get(':profileId/followers')
  @ApiGetProfileFollowers()
  async getProfileFollowers(
    @Param('profileId', ParseIntPipe) profileId: number,
    @Query() query: ProfileFollowListQueryParamsDto,
    @ExtractUserFromRequest() { id: viewerUserId }: UserContextDto,
  ): Promise<ProfileFollowListPageViewDto> {
    return this.queryBus.execute(new GetProfileFollowersQuery(profileId, query, viewerUserId));
  }

  @Get(':profileId')
  @Public()
  @OptionalAuth()
  @ApiGetPublicProfile()
  async getPublicProfile(
    @Param('profileId', ParseIntPipe) profileId: number,
    @ExtractOptionalUserFromRequest() viewer: UserContextDto | null,
  ): Promise<PublicProfileViewDto> {
    return await this.queryBus.execute(new GetPublicProfileQuery(profileId, viewer?.id));
  }

  // Avatar -------------------------------------
  @Post('avatar')
  // todo: выяснить можно ли как то переопределить ошибку FileInterceptor
  @UseInterceptors(FileInterceptor('avatar'))
  @ApiUploadAvatar()
  async uploadAvatar(
    @ExtractUserFromRequest() { id: userId }: UserContextDto,
    @AvatarFile() file: Express.Multer.File,
  ): Promise<AvatarViewDto> {
    const dto: UploadAvatarApplicationDto = {
      userId,
      mimetype: file.mimetype,
      buffer: file.buffer,
      size: file.size,
    };

    return await this.commandBus.execute(new UploadAvatarCommand(dto));
  }

  @Delete('avatar')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiDeleteAvatar()
  async deleteAvatar(@ExtractUserFromRequest() { id: userId }: UserContextDto): Promise<void> {
    await this.commandBus.execute(new DeleteAvatarCommand(userId));
  }
}
