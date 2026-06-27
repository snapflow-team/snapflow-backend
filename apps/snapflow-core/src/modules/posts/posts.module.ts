import { DeletePostUseCase } from './application/usecases/delete-post.use.case';
import { EditPostUseCase } from './application/usecases/edit-post.use.case';
import { CreatePostUseCase } from './application/usecases/create-post-use.case';
import { GetDraftQueryHandler } from './application/queries/get-draft.query-handler';
import { GetPostsQueryHandler } from './application/queries/get-posts.query-handler';
import { GetPostQueryHandler } from './application/queries/get-post.query-handler';
import { PostsRepository } from './infrastructure/posts-repository';
import { PostsQueryRepository } from './infrastructure/posts.query-repository';
import { Module } from '@nestjs/common';
import { PostsController } from './api/posts.controller';
import { PostCommentsController } from './comments/api/post-comments.controller';
import { UserAccountsModule } from '../user-accounts/user-accounts.module';
import { GetUserPostsQueryHandler } from './application/queries/get-user-posts.query-handler';
import { SaveDraftUseCase } from './application/usecases/save-draft.usecase';
import { TogglePostLikeUseCase } from './application/usecases/toggle-post-like.usecase';
import { CreateCommentUseCase } from './comments/application/usecases/create-comment.usecase';
import { PostLikesRepository } from './infrastructure/post-likes.repository';
import { CommentsRepository } from './comments/infrastructure/comments.repository';
import { CommentsQueryRepository } from './comments/infrastructure/comments.query-repository';
import { GetPostCommentsQueryHandler } from './comments/application/queries/get-post-comments.query-handler';
import { GetCommentQueryHandler } from './comments/application/queries/get-comment.query-handler';
import { GetCommentRepliesQueryHandler } from './comments/application/queries/get-comment-replies.query-handler';
import { OutboxRepository } from './outbox/repositories/outbox.repository';
import { OutboxProcessorService } from './outbox/services/outbox-processor.service';

const useCases = [
  CreatePostUseCase,
  EditPostUseCase,
  DeletePostUseCase,
  SaveDraftUseCase,
  TogglePostLikeUseCase,
  CreateCommentUseCase,
];
const queries = [
  GetPostQueryHandler,
  GetPostsQueryHandler,
  GetDraftQueryHandler,
  GetUserPostsQueryHandler,
  GetPostCommentsQueryHandler,
  GetCommentQueryHandler,
  GetCommentRepliesQueryHandler,
];
const services = [OutboxProcessorService];
const repositories = [
  PostsRepository,
  PostsQueryRepository,
  PostLikesRepository,
  CommentsRepository,
  CommentsQueryRepository,
  OutboxRepository,
];

@Module({
  imports: [UserAccountsModule],
  controllers: [PostsController, PostCommentsController],
  providers: [...useCases, ...queries, ...services, ...repositories],
  exports: [],
})
export class PostsModule {}
