import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ExtractUserFromRequest } from '../../user-accounts/auth/domain/guards/decorators/extract-user-from-request.decorator';
import { UserContextDto } from '../../user-accounts/auth/domain/guards/dto/user-context.dto';
import { JwtAuthGuard } from '../../user-accounts/auth/domain/guards/bearer/jwt-auth.guard';
import { CreatePostInputDto } from './input-dto/create-post.input-dto';
import { GetPostQuery } from '../application/queries/get-post.query-handler';
import { CreatePostCommand } from '../application/usecases/create-post-use.case';
import { PublishPostCommand } from '../application/usecases/publish-post.use.case';
import { PostViewDto } from './view-dto/post.view-dto';
import { CreateDraftPostSwagger, CreatePublishPostSwagger } from './swagger/create-post.swagger';
import { PublishPostSwagger } from './swagger/publish-post.swagger';
import { EditPostSwagger } from './swagger/edit-post.swagger';
import { DeletePostSwagger } from './swagger/delete-post.swagger';
import { GetProfilePostsSwagger } from './swagger/get-profile-posts.swagger';
import { GetOwnPostSwagger, GetPublicPostSwagger } from './swagger/get-post.swagger';
import { Public } from '../../user-accounts/decorators/public.decorator';
import { EditPostCommand } from '../application/usecases/edit-post.use.case';
import { DeletePostCommand } from '../application/usecases/delete-post.use.case';
import { UpdatePostInputDto } from './input-dto/update-post.input.dto';
import { PostVisibility } from '../enums/post-visibility.enum';
import { GetProfilePostsQuery } from '../application/queries/get-profile-posts.query-handler';
import { GetPostsQueryParamsDto } from './input-dto/get-posts.query-params.dto';
import { PostsPageViewDto } from './view-dto/posts-page.view-dto';
import { PostStatus } from '@generated/prisma-snapflow';
import { GetPostsQuery } from '../application/queries/get-posts.query-handler';
import { GetProfilePostsQueryParamsDto } from './input-dto/get-profile-posts-query-params.dto';

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
    return this.queryBus.execute<GetPostQuery, PostViewDto>(
      new GetPostQuery(postId, PostVisibility.Public, user.id),
    );
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
    return this.queryBus.execute<GetPostQuery, PostViewDto>(
      new GetPostQuery(postId, PostVisibility.Owner, user.id),
    );
  }

  @Post(':id/publish')
  @PublishPostSwagger()
  async publish(
    @Param('id', ParseIntPipe) postId: number,
    @ExtractUserFromRequest() user: UserContextDto,
  ): Promise<PostViewDto> {
    await this.commandBus.execute(new PublishPostCommand(postId, user.id));

    return this.queryBus.execute<GetPostQuery, PostViewDto>(
      new GetPostQuery(postId, PostVisibility.Public, user.id),
    );
  }

  @Patch(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @EditPostSwagger()
  async editPost(
    @Body() dto: UpdatePostInputDto,
    @Param('id', ParseIntPipe) postId: number,
    @ExtractUserFromRequest() user: UserContextDto,
  ): Promise<void> {
    await this.commandBus.execute<EditPostCommand, void>(new EditPostCommand(user.id, postId, dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @DeletePostSwagger()
  async deletePost(
    @Param('id', ParseIntPipe) postId: number,
    @ExtractUserFromRequest() user: UserContextDto,
  ): Promise<void> {
    await this.commandBus.execute<DeletePostCommand, void>(new DeletePostCommand(user.id, postId));
  }

  @Get('profile/:userId')
  @Public()
  @GetProfilePostsSwagger()
  async getProfilePosts(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: GetProfilePostsQueryParamsDto,
  ): Promise<PostsPageViewDto> {
    return this.queryBus.execute(
      new GetProfilePostsQuery(userId, query.pageNumber, query.pageSize),
    );
  }

  //чтобы юзер мог получить пост со статусом драфт или пубдиш
  @Get(':id')
  @GetOwnPostSwagger()
  async getPostById(
    @Param('id', ParseIntPipe) postId: number,
    @ExtractUserFromRequest() user: UserContextDto,
  ): Promise<PostViewDto> {
    return this.queryBus.execute<GetPostQuery, PostViewDto>(
      new GetPostQuery(postId, PostVisibility.Owner, user.id),
    );
  }

  @Get(':id/public')
  @Public()
  @GetPublicPostSwagger()
  async getPublicPost(@Param('id', ParseIntPipe) postId: number): Promise<PostViewDto> {
    return this.queryBus.execute<GetPostQuery, PostViewDto>(
      new GetPostQuery(postId, PostVisibility.Public),
    );
  }

  @Get()
  @Public()
  async getPost(@Query() query: GetPostsQueryParamsDto): Promise<PostsPageViewDto> {
    return this.queryBus.execute(new GetPostsQuery(query.pageNumber, query.pageSize));
  }
}
