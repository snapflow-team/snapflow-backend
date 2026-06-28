import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { Configuration } from '../../../../setup/configuration/configuration';
import { ApiSettings } from '../../../../setup/configuration/api-settings';
import { AdminSettings } from '../../../../setup/configuration/admin-settings';
import { ADMIN_SESSION_COOKIE_NAME } from '../../constants/admin-auth.constants';

@Injectable()
export class AdminSessionCookieService {
  private readonly apiSettings: ApiSettings;
  private readonly adminSettings: AdminSettings;

  constructor(private readonly configService: ConfigService<Configuration, true>) {
    this.apiSettings = this.configService.get<ApiSettings>('apiSettings');
    this.adminSettings = this.configService.get<AdminSettings>('adminSettings');
  }

  setSessionCookie(res: Response, sessionId: string): void {
    res.cookie(ADMIN_SESSION_COOKIE_NAME, sessionId, {
      ...this.apiSettings.getCookieOptions(),
      maxAge: this.getSessionMaxAgeMs(),
    });
  }

  clearSessionCookie(res: Response): void {
    const { httpOnly, secure, sameSite } = this.apiSettings.getCookieOptions();

    res.clearCookie(ADMIN_SESSION_COOKIE_NAME, {
      httpOnly,
      secure,
      sameSite,
    });
  }

  private getSessionMaxAgeMs(): number {
    const ms_per_hours: number = 60 * 60 * 1000;
    return this.adminSettings.sessionMaxAgeHours * ms_per_hours;
  }
}
