import { PostCreatedEvent } from '../../../../posts/domain/events/post-created.event';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { PUB_SUB } from '../../../constants/pub-sub-provider.constant';
import { PubSub } from 'graphql-subscriptions';
import { POST_CREATED_EVENT } from '../constants/post-created-event.constant';
import { AdminPostsQueryRepository } from '../../../infrastructure/repositories/admin-posts.query-repository';
import { AdminPostListItemModel } from '../../../api/models/admin-post-list-item.model';
import { LoggerFactory } from '../../../../logger/logger.factory';
import { ContextLogger } from '../../../../logger/context-logger';

@EventsHandler(PostCreatedEvent)
export class PostCreatedSubscriptionEventHandler implements IEventHandler<PostCreatedEvent> {
  private readonly logger: ContextLogger;
  constructor(
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
    private readonly postsQueryRepository: AdminPostsQueryRepository,
    private readonly loggerFactory: LoggerFactory,
  ) {
    this.logger = this.loggerFactory.create(PostCreatedSubscriptionEventHandler.name);
  }

  async handle(event: PostCreatedEvent) {
    try {
      const post: AdminPostListItemModel | null = await this.postsQueryRepository.findPostById(
        event.postId,
      );
      if (!post) {
        this.logger.warn(`Post with id: ${event.postId} not found`, this.handle.name);
        return;
      }

      await this.pubSub.publish(POST_CREATED_EVENT, {
        postCreated: post,
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Something went wrong';

      this.logger.error(
        `Unable to publish POST_CREATED_EVENT to PubSub with postId: ${event.postId}. Error: ${errorMessage}`,
      );
    }
  }
}
