import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { PostCreatedEvent } from '../../../posts/domain/events/post-created.event';
import { NextjsRevalidationService } from '../nextjs-revalidation.service';

@EventsHandler(PostCreatedEvent)
export class RevalidateOnPostCreatedEventHandler implements IEventHandler<PostCreatedEvent> {
  constructor(private readonly revalidationService: NextjsRevalidationService) {}

  async handle() {
    await this.revalidationService.checkAndRevalidatePosts();
  }
}
