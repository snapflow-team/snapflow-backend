import { Body, Controller, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { PostStatus } from '@generated/prisma';
import { ExtractUserFromRequest } from '../../user-accounts/auth/domain/guards/decorators/extract-user-from-request.decorator';
import { UserContextDto } from '../../user-accounts/auth/domain/guards/dto/user-context.dto';
import { JwtAuthGuard } from '../../user-accounts/auth/domain/guards/bearer/jwt-auth.guard';
import { CreatePostInputDto } from './input-dto/create-post.input-dto';
import { GetPostQuery } from '../application/queries/get-post.query-handler';
import { CreatePostCommand } from '../application/usecases/create-post-use.case';
import { PublishPostCommand } from '../application/usecases/publish-post.use.case';
import { PostViewDto } from './view-dto/post.view-dto';
import { CreateDraftPostSwagger, CreatePublishPostSwagger } from './swagger/create-post.swagger';

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
    const postId = await this.commandBus.execute<CreatePostCommand, number>(
      new CreatePostCommand(dto, user.id, PostStatus.PUBLISHED),
    );
    // TODO уточнить у фронта нужна ли виев модель сразу
    return this.queryBus.execute(new GetPostQuery(postId, user.id, [PostStatus.PUBLISHED]));
  }

  @Post('draft')
  @CreateDraftPostSwagger()
  async createDraft(
    @Body() dto: CreatePostInputDto,
    @ExtractUserFromRequest() user: UserContextDto,
  ): Promise<PostViewDto> {
    const postId = await this.commandBus.execute<CreatePostCommand, number>(
      new CreatePostCommand(dto, user.id, PostStatus.DRAFT),
    );
    return this.queryBus.execute(new GetPostQuery(postId, user.id, [PostStatus.DRAFT]));
  }

  @Post(':id/publish')
  async publish(
    @Param('id', ParseIntPipe) postId: number,
    @ExtractUserFromRequest() user: UserContextDto,
  ): Promise<PostViewDto> {
    await this.commandBus.execute(new PublishPostCommand(postId, user.id));

    return this.queryBus.execute(new GetPostQuery(postId, user.id, [PostStatus.PUBLISHED]));
  }
}
