import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ExtractOptionalUserFromRequest } from '../../../user-accounts/auth/domain/guards/decorators/extract-optional-user-from-request.decorator';
import { ExtractUserFromRequest } from '../../../user-accounts/auth/domain/guards/decorators/extract-user-from-request.decorator';
import { UserContextDto } from '../../../user-accounts/auth/domain/guards/dto/user-context.dto';
import { JwtAuthGuard } from '../../../user-accounts/auth/domain/guards/bearer/jwt-auth.guard';
import { OptionalAuth } from '../../../user-accounts/decorators/optional-auth.decorator';
import { Public } from '../../../user-accounts/decorators/public.decorator';
import { CreateCommentInputDto } from './input-dto/create-comment.input-dto';
import { GetPostCommentsQueryParamsDto } from './input-dto/get-post-comments.query-params.dto';
import { CommentItemViewDto } from './view-dto/comment-item.view-dto';
import { PostCommentsPageViewDto } from './view-dto/post-comments-page.view-dto';
import { CreateCommentCommand } from '../application/usecases/create-comment.usecase';
import { ToggleCommentLikeCommand } from '../application/usecases/toggle-comment-like.usecase';
import { GetCommentQuery } from '../application/queries/get-comment.query-handler';
import { GetCommentRepliesQuery } from '../application/queries/get-comment-replies.query-handler';
import { GetPostCommentsQuery } from '../application/queries/get-post-comments.query-handler';
import { CreateCommentSwagger } from './swagger/create-comment.swagger';
import { GetCommentRepliesSwagger } from './swagger/get-comment-replies.swagger';
import { GetPostCommentsSwagger } from './swagger/get-post-comments.swagger';
import { ToggleCommentLikeSwagger } from './swagger/toggle-comment-like.swagger';

@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostCommentsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post(':postId/comments')
  @CreateCommentSwagger()
  async createComment(
    @Param('postId', ParseIntPipe) postId: number,
    @Body() { text, parentId }: CreateCommentInputDto,
    @ExtractUserFromRequest() { id: userId }: UserContextDto,
  ): Promise<CommentItemViewDto> {
    const commentId: number = await this.commandBus.execute<CreateCommentCommand, number>(
      new CreateCommentCommand({
        userId,
        postId,
        text,
        parentId: parentId != null ? Number(parentId) : null,
      }),
    );

    return this.queryBus.execute<GetCommentQuery, CommentItemViewDto>(
      new GetCommentQuery(commentId),
    );
  }

  @Get(':postId/comments')
  @Public()
  @OptionalAuth()
  @GetPostCommentsSwagger()
  async getPostComments(
    @Param('postId', ParseIntPipe) postId: number,
    @Query() query: GetPostCommentsQueryParamsDto,
    @ExtractOptionalUserFromRequest() viewer: UserContextDto | null,
  ): Promise<PostCommentsPageViewDto> {
    return this.queryBus.execute<GetPostCommentsQuery, PostCommentsPageViewDto>(
      new GetPostCommentsQuery(query, postId, viewer?.id),
    );
  }

  @Post(':postId/comments/:commentId/like')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ToggleCommentLikeSwagger()
  async toggleCommentLike(
    @Param('postId', ParseIntPipe) postId: number,
    @Param('commentId', ParseIntPipe) commentId: number,
    @ExtractUserFromRequest() { id: userId }: UserContextDto,
  ): Promise<void> {
    await this.commandBus.execute<ToggleCommentLikeCommand, void>(
      new ToggleCommentLikeCommand(userId, postId, commentId),
    );
  }

  @Get(':postId/comments/:commentId/replies')
  @Public()
  @GetCommentRepliesSwagger()
  async getCommentReplies(
    @Param('postId', ParseIntPipe) postId: number,
    @Param('commentId', ParseIntPipe) commentId: number,
    @Query() query: GetPostCommentsQueryParamsDto,
  ): Promise<PostCommentsPageViewDto> {
    return this.queryBus.execute<GetCommentRepliesQuery, PostCommentsPageViewDto>(
      new GetCommentRepliesQuery(query, postId, commentId),
    );
  }
}
