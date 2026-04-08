import { Injectable } from '@nestjs/common';
import { EmailTemplate } from './types';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../../../setup/configuration/configuration';
import { EnvironmentSettings } from '../../../setup/configuration/environment-settings';

//todo(refactor) нужен ли этот класс вообще , может быть лучше удалить его и унести в emailService?
@Injectable()
export class EmailTemplates {
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService<Configuration, true>) {
    const environmentSettings = this.configService.get<EnvironmentSettings>('environmentSettings');

    // Определяем базовый URL один раз при инициализации сервиса
    this.baseUrl = environmentSettings.isProduction
      ? 'https://snapflow.cc'
      : 'http://localhost:3000';
  }
  //todo(vitaliy) rename methods to verbs
  registrationEmail(code: string): EmailTemplate {
    return {
      subject: 'Confirmation of registration',
      html: `
        <h1>Thanks for your registration</h1>
        <p>To finish registration please follow the link below:<br>
          <a href='${this.baseUrl}/sign-up/confirm-email?code=${code}'>complete registration</a>
        </p>
      `,
    };
  }

  passwordRecoveryEmail(code: string): EmailTemplate {
    return {
      subject: 'Password recovery',
      html: `
        <h1>Password recovery</h1>
        <p>To finish password recovery please follow the link below:<br>
          <a href='${this.baseUrl}/password-recovery/set-new-password?recoveryCode=${code}'>recovery password</a>
        </p>
      `,
    };
  }
}
