import { CommandBus, EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { PostCreatedEvent } from '../../../posts/domain/events/post-created.event';
import { HomeRevalidationActivitySource } from '../constants/home-revalidation.constants';
import { RecordHomeRevalidationActivityCommand } from '../application/record-home-revalidation-activity-usecase';

@EventsHandler(PostCreatedEvent)
export class RevalidateOnPostCreatedEventHandler implements IEventHandler<PostCreatedEvent> {
  constructor(private readonly commandBus: CommandBus) {}

  async handle() {
    await this.commandBus.execute(
      new RecordHomeRevalidationActivityCommand(HomeRevalidationActivitySource.Post),
    );
  }
}
