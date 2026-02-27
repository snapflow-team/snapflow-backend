import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Prisma } from '@generated/prisma';
import { ExtractUserFromRequest } from '../../user-accounts/auth/domain/guards/decorators/extract-user-from-request.decorator';
import { UserContextDto } from '../../user-accounts/auth/domain/guards/dto/user-context.dto';
import { CreatePostCommand } from '../application/usecases/create-post.usecase';
import { CreatePostInputDto } from './create-post.input-dto';
import { JwtAuthGuard } from '../../user-accounts/auth/domain/guards/bearer/jwt-auth.guard';
import { GetPostQuery } from '../application/queries/get-post.query-handler';
import { PostWithMediaType } from '../infrastructure/posts.query-repository';

type CreatedPostOutput = Prisma.PostGetPayload<{
  include: { postMedias: true };
}>;

@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  async createPost(
    @Body() dto: CreatePostInputDto,
    @ExtractUserFromRequest() user: UserContextDto,
  ): Promise<CreatedPostOutput> {
    return this.commandBus.execute<CreatePostCommand, CreatedPostOutput>(
      new CreatePostCommand(dto, user.id),
    );
  }

  @Get(':id')
  async getPostById(
    @Param('id') postId: number,
    @ExtractUserFromRequest() user: UserContextDto,
  ): Promise<PostWithMediaType> {
    return this.queryBus.execute(new GetPostQuery(postId, user.id));
  }
}
