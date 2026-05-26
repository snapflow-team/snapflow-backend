import { CommandBus, EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { NewSignupEvent } from '../../../user-accounts/auth/domain/events/new-signup.event';
import { HomeRevalidationActivitySource } from '../constants/home-revalidation.constants';
import { RecordHomeRevalidationActivityCommand } from '../application/record-home-revalidation-activity-usecase';

@EventsHandler(NewSignupEvent)
export class RevalidateOnNewSignupEventHandler implements IEventHandler<NewSignupEvent> {
  constructor(private readonly commandBus: CommandBus) {}

  async handle() {
    await this.commandBus.execute(
      new RecordHomeRevalidationActivityCommand(HomeRevalidationActivitySource.Signup),
    );
  }
}
