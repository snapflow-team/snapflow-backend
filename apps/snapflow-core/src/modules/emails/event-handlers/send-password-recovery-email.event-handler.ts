import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { EmailTemplate } from '../templates/types';
import { EmailTemplates } from '../templates/email.templates';
import { EmailService } from '../services/email.service';
import { UserPasswordRecoveryEvent } from '../../user-accounts/auth/domain/events/user-password-recovery.event';

@EventsHandler(UserPasswordRecoveryEvent)
export class SendPasswordRecoveryEmailEventHandler
  implements IEventHandler<UserPasswordRecoveryEvent>
{
  constructor(
    private emailService: EmailService,
    private readonly templates: EmailTemplates,
  ) {}

  async handle(event: UserPasswordRecoveryEvent) {
    const { email, confirmationCode } = event;

    const template: EmailTemplate = this.templates.passwordRecoveryEmail(confirmationCode);
    try {
      await this.emailService.sendEmail(email, template);
    } catch (e) {
      console.error('send email', e);
    }
  }
}
