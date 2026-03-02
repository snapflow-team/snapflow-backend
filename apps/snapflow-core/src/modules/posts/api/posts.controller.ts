import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { PostStatus } from '@generated/prisma';
import { ExtractUserFromRequest } from '../../user-accounts/auth/domain/guards/decorators/extract-user-from-request.decorator';
import { UserContextDto } from '../../user-accounts/auth/domain/guards/dto/user-context.dto';
import { JwtAuthGuard } from '../../user-accounts/auth/domain/guards/bearer/jwt-auth.guard';
import { CreatePostInputDto } from './input-dto/create-post.input-dto';
import { GetPostQuery, PostVisibility } from '../application/queries/get-post.query-handler';
import { CreatePostCommand } from '../application/usecases/create-post-use.case';
import { PublishPostCommand } from '../application/usecases/publish-post.use.case';
import { PostViewDto } from './view-dto/post.view-dto';
import { CreateDraftPostSwagger, CreatePublishPostSwagger } from './swagger/create-post.swagger';
import { Public } from '../../user-accounts/decorators/public.decorator';
import { EditPostCommand } from '../application/usecases/edit-post.use.case';
import { UpdatePostInputDto } from './input-dto/update-post.input.dto';

@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @CreatePublishPostSwagger()
  async createPost(
    @Body() dto: CreatePostInputDto,
    @ExtractUserFromRequest() user: UserContextDto,
  ): Promise<PostViewDto> {
    const postId: number = await this.commandBus.execute<CreatePostCommand, number>(
      new CreatePostCommand(dto, user.id, PostStatus.PUBLISHED),
    );
    return this.queryBus.execute(new GetPostQuery(postId, PostVisibility.Public, user.id));
  }

  @Post('draft')
  @CreateDraftPostSwagger()
  async createDraft(
    @Body() dto: CreatePostInputDto,
    @ExtractUserFromRequest() user: UserContextDto,
  ): Promise<PostViewDto> {
    const postId: number = await this.commandBus.execute<CreatePostCommand, number>(
      new CreatePostCommand(dto, user.id, PostStatus.DRAFT),
    );
    return this.queryBus.execute(new GetPostQuery(postId, PostVisibility.Owner, user.id));
  }

  @Post(':id/publish')
  async publish(
    @Param('id', ParseIntPipe) postId: number,
    @ExtractUserFromRequest() user: UserContextDto,
  ): Promise<PostViewDto> {
    await this.commandBus.execute(new PublishPostCommand(postId, user.id));

    return this.queryBus.execute(new GetPostQuery(postId, PostVisibility.Public, user.id));
  }

  @Patch(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async editPost(
    @Body() dto: UpdatePostInputDto,
    @Param('id', ParseIntPipe) postId: number,
    @ExtractUserFromRequest() user: UserContextDto,
  ): Promise<void> {
    return this.commandBus.execute(new EditPostCommand(user.id, postId, dto));
  }

  //чтобы юзер мог получить пост со статусом драфт или пубдиш
  @Get(':id')
  async getPostById(
    @Param('id', ParseIntPipe) postId: number,
    @ExtractUserFromRequest() user: UserContextDto,
  ): Promise<PostViewDto> {
    return this.queryBus.execute(new GetPostQuery(postId, PostVisibility.Owner, user.id));
  }

  @Get(':id/public')
  @Public()
  async getPublicPost(@Param('id', ParseIntPipe) postId: number): Promise<PostViewDto> {
    return this.queryBus.execute(new GetPostQuery(postId, PostVisibility.Public));
  }
}
