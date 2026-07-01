import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotificationsRepository } from '../../infrastructure/notifications.repository';

export class MarkAllNotificationsReadCommand {
  constructor(public readonly userId: number) {}
}

@CommandHandler(MarkAllNotificationsReadCommand)
export class MarkAllNotificationsReadUseCase
  implements ICommandHandler<MarkAllNotificationsReadCommand>
{
  constructor(private readonly notificationsRepository: NotificationsRepository) {}

  async execute({ userId }: MarkAllNotificationsReadCommand): Promise<void> {
    await this.notificationsRepository.markAllAsRead(userId);
  }
}
