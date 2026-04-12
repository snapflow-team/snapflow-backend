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
import { PostViewDto } from './view-dto/post.view-dto';
import { CreateDraftPostSwagger, CreatePublishPostSwagger } from './swagger/create-post.swagger';
import { EditPostSwagger } from './swagger/edit-post.swagger';
import { DeletePostSwagger } from './swagger/delete-post.swagger';
import { GetProfilePostsSwagger } from './swagger/get-profile-posts.swagger';
import { GetPostByIdSwagger, GetPublicPostSwagger } from './swagger/get-post.swagger';
import { Public } from '../../user-accounts/decorators/public.decorator';
import { EditPostCommand } from '../application/usecases/edit-post.use.case';
import { DeletePostCommand } from '../application/usecases/delete-post.use.case';
import { UpdatePostInputDto } from './input-dto/update-post.input.dto';
import { GetProfilePostsQuery } from '../application/queries/get-profile-posts.query-handler';
import { GetPostsQueryParamsDto } from './input-dto/get-posts.query-params.dto';
import { PostsPageViewDto } from './view-dto/posts-page.view-dto';
import { PostStatus } from '@generated/prisma-snapflow';
import { GetPostsQuery } from '../application/queries/get-posts.query-handler';
import { GetPublicPostsSwagger } from './swagger/get-public-posts.swagger';
import { PaginatedViewDto } from '../../../../../../libs/dto/paginated.view-dto';
import { GetMyDraftsQuery } from '../application/queries/get-my-drafts.query.handler';
import { GetDraftPostsSwagger } from './swagger/get-draft-posts.swagger';
import { GetPublicPostQuery } from '../application/queries/get-public-post.query-handler';

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
      new CreatePostCommand({
        userId: user.id,
        status: PostStatus.PUBLISHED,
        description: dto.description,
        fileIds: dto.fileIds,
      }),
    );
    return this.queryBus.execute<GetPostQuery, PostViewDto>(new GetPostQuery(postId, user.id));
  }

  @Post('draft')
  @CreateDraftPostSwagger()
  async createDraft(
    @Body() dto: CreatePostInputDto,
    @ExtractUserFromRequest() user: UserContextDto,
  ): Promise<PostViewDto> {
    const postId: number = await this.commandBus.execute<CreatePostCommand, number>(
      new CreatePostCommand({
        userId: user.id,
        status: PostStatus.DRAFT,
        description: dto.description,
        fileIds: dto.fileIds,
      }),
    );
    return this.queryBus.execute<GetPostQuery, PostViewDto>(new GetPostQuery(postId, user.id));
  }

  @Patch(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @EditPostSwagger()
  async editPost(
    @Body() dto: UpdatePostInputDto,
    @Param('id', ParseIntPipe) postId: number,
    @ExtractUserFromRequest() user: UserContextDto,
  ): Promise<void> {
    await this.commandBus.execute<EditPostCommand, void>(
      new EditPostCommand({ userId: user.id, postId, description: dto.description }),
    );
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

  @Get('drafts')
  @GetDraftPostsSwagger()
  async getMyDrafts(@ExtractUserFromRequest() user: UserContextDto): Promise<PostViewDto[]> {
    return this.queryBus.execute(new GetMyDraftsQuery(user.id));
  }

  @Get('user/:userId')
  @Public()
  @GetProfilePostsSwagger()
  async getProfilePosts(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() dto: GetPostsQueryParamsDto,
  ): Promise<PaginatedViewDto<PostsPageViewDto>> {
    return this.queryBus.execute(new GetProfilePostsQuery(dto, userId));
  }

  @Get(':id')
  @GetPostByIdSwagger()
  @Public()
  async getPostById(@Param('id', ParseIntPipe) postId: number): Promise<PostViewDto> {
    return this.queryBus.execute<GetPostQuery, PostViewDto>(new GetPostQuery(postId));
  }

  @Get(':id/public')
  @Public()
  @GetPublicPostSwagger()
  async getPublicPost(@Param('id', ParseIntPipe) postId: number): Promise<PostViewDto> {
    return this.queryBus.execute<GetPublicPostQuery, PostViewDto>(new GetPublicPostQuery(postId));
  }

  @Get()
  @Public()
  @GetPublicPostsSwagger()
  async getPosts(@Query() query: GetPostsQueryParamsDto): Promise<PaginatedViewDto<PostViewDto>> {
    return this.queryBus.execute(new GetPostsQuery(query));
  }
}
