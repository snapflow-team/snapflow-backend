import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '../../../auth/domain/guards/bearer/jwt-auth.guard';
import { ExtractUserFromRequest } from '../../../auth/domain/guards/decorators/extract-user-from-request.decorator';
import { UserContextDto } from '../../../auth/domain/guards/dto/user-context.dto';
import { UpdateProfileInputDto } from './dto/input-dto/update-profile.input-dto';
import { UpdateProfileCommand } from '../application/usecases/update-profile.usecase';
import { ProfileViewDto } from './dto/view-dto/profile.view-dto';
import { GetProfileQuery } from '../application/queries/get-profile.query-handler';
import { ApiTags } from '@nestjs/swagger';
import { ApiUpdateProfile } from './swagger/update-profile.swagger';
import { ApiGetProfile } from './swagger/get-profile.swagger';
import { FilesClient } from '../../../../integrations/files/files.client';
import { FileInterceptor } from '@nestjs/platform-express';
import { AvatarFile } from '../pipes/avatar-file.pipe';
import { UploadAvatarApplicationDto } from '../application/dto/apload-avatar.application-dto';
import { AvatarViewDto } from './dto/view-dto/acatar.view-dto';
import { UploadAvatarCommand } from '../application/usecases/upload-avatar.usecase';
import { ApiUploadAvatar } from './swagger/upload-avatar.swagger';
import { DeleteAvatarCommand } from '../application/usecases/delete-avatar.usecase';
import { ApiDeleteAvatar } from './swagger/delete-avatar.swagger';

@ApiTags('Profile')
@UseGuards(JwtAuthGuard)
@Controller('users/profile')
export class ProfileController {
  constructor(
    private filesClient: FilesClient,
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
