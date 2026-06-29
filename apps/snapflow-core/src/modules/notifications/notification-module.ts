import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { BusinessRulesSettings } from '../../setup/configuration/business-rules-settings';
import { EmailService } from './emails/services/email.service';
import { EmailTemplates } from './emails/templates/email.templates';
import { SendConfirmationEmailWhenUserRegisteredEventHandler } from './emails/event-handlers/send-confirmation-email-when-user-registered.event-handler';
import { SendPasswordRecoveryEmailEventHandler } from './emails/event-handlers/send-password-recovery-email.event-handler';
import { WebsocketService } from './websocket/services/websocket.service';
import { NotificationGateway } from './websocket/gateway/notification-websocket.gateway';
import { NotificationEventsConsumer } from './websocket/services/notifications-events-consumer';
import { WebsocketNotificationService } from './websocket/services/websocket-notification.service';
import { Configuration } from '../../setup/configuration/configuration';
import { NotificationsRepository } from './infrastructure/notifications.repository';
import { JwtAuthModule } from '../user-accounts/auth/jwt-auth.module';

const services = [
  EmailService,
  EmailTemplates,
  WebsocketService,
  WebsocketNotificationService,
  NotificationEventsConsumer,
];
const eventHandlers = [
  SendConfirmationEmailWhenUserRegisteredEventHandler,
  SendPasswordRecoveryEmailEventHandler,
];
const repositories = [NotificationsRepository];
@Module({
  imports: [
    JwtAuthModule,
    MailerModule.forRootAsync({
      inject: [ConfigService],

      useFactory: (configService: ConfigService<Configuration, true>) => {
        const { appEmail, appPassword }: BusinessRulesSettings =
          configService.get<BusinessRulesSettings>('businessRulesSettings');

        return {
          transport: `smtps://${encodeURIComponent(appEmail)}:${encodeURIComponent(appPassword)}@smtp.gmail.com`,
          defaults: { from: `SnapFlow <${appEmail}>` },
        };
      },
    }),
  ],
  providers: [...services, ...eventHandlers, ...repositories, NotificationGateway],
  exports: [],
})
export class NotificationModule {
  constructor() {}
}
