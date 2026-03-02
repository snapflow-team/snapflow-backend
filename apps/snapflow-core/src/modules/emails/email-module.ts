import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { EmailService } from './services/email.service';
import { EmailTemplates } from './templates/email.templates';
import { SendConfirmationEmailWhenUserRegisteredEventHandler } from './event-handlers/send-confirmation-email-when-user-registered.event-handler';
import { SendPasswordRecoveryEmailEventHandler } from './event-handlers/send-password-recovery-email.event-handler';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '@nestjs/cli/lib/configuration';
import { BusinessRulesSettings } from '../../setup/configuration/business-rules-settings';

@Module({
  imports: [
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
  providers: [
    EmailService,
    EmailTemplates,
    SendConfirmationEmailWhenUserRegisteredEventHandler,
    SendPasswordRecoveryEmailEventHandler,
  ],
  exports: [EmailService],
})
export class EmailModule {}
