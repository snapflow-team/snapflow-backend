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
import { UserAccountsModule } from '../user-accounts/user-accounts.module';
import { FilesClientModule } from '../integrations/files/files-client.module';
import { GetProfilePostsQueryHandler } from './application/queries/get-profile-posts.query-handler';
import { SaveDraftUseCase } from './application/usecases/save-draft.usecase';

const useCases = [CreatePostUseCase, EditPostUseCase, DeletePostUseCase, SaveDraftUseCase];
const queries = [
  GetPostQueryHandler,
  GetPostsQueryHandler,
  GetDraftQueryHandler,
  GetProfilePostsQueryHandler,
];
const services = [];
const repositories = [PostsRepository, PostsQueryRepository];

@Module({
  imports: [UserAccountsModule, FilesClientModule],
  controllers: [PostsController],
  providers: [...useCases, ...queries, ...services, ...repositories],
  exports: [],
})
export class PostsModule {}
