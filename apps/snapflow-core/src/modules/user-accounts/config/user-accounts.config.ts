import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsBoolean, IsEnum, IsNotEmpty, IsNumber } from 'class-validator';
import { CookieOptions } from 'express';
import { configValidationUtility } from '../../../../../../libs/common/config/config-validation.utility';
import { Environments } from '../../../../../../libs/common/enums/enviroments.enum';

export enum SameSite {
  STRICT = 'strict',
  LAX = 'lax',
  NONE = 'none',
}

@Injectable()
export class UserAccountsConfig {
  @IsNotEmpty({
    message: 'Set Env variable JWT_EXPIRATION_AT, examples: 1h, 5m, 2d',
  })
  accessTokenExpireIn: string | number;

  @IsNotEmpty({
    message: 'Set Env variable JWT_EXPIRATION_RT, examples: 1h, 5m, 2d',
  })
  refreshTokenExpireIn: string | number;

  @IsNotEmpty({
    message: 'Set Env variable JWT_SECRET_AT, dangerous for security!',
  })
  accessTokenSecret: string;

  @IsNotEmpty({
    message: 'Set Env variable JWT_SECRET_RT, dangerous for security!',
  })
  refreshTokenSecret: string;

  @IsBoolean({
    message:
      'Set Env variable HTTP_ONLY to enable/disable HttpOnly flag for cookies. Example: true, available values: true, false, 0, 1',
  })
  httpOnly: boolean;

  @IsBoolean({
    message:
      'Set Env variable SECURE to enable/disable Secure flag for cookies (only HTTPS). Example: true, available values: true, false, 0, 1',
  })
  secure: boolean;

  @IsEnum(SameSite, {
    message:
      'Set Env variable SAME_SITE to control cookie cross-site behavior. Available values: ' +
      configValidationUtility.getEnumValues(Environments).join(', '),
  })
  sameSite: CookieOptions['sameSite'];

  @IsNumber(
    {},
    {
      message:
        'Set Env variable MAX_AGE to specify cookie max age in milliseconds. Example: 3600000 (1 hour)',
    },
  )
  maxAge: number;

  @IsNotEmpty({
    message: 'Set Env variable PATH to define cookie path. Example: "/"',
  })
  path: string;

  constructor(private configService: ConfigService<any, true>) {
    this.accessTokenExpireIn = this.configService.get('JWT_EXPIRATION_AT');

    this.refreshTokenExpireIn = this.configService.get('JWT_EXPIRATION_RT');

    this.accessTokenSecret = this.configService.get('JWT_SECRET_AT');

    this.refreshTokenSecret = this.configService.get('JWT_SECRET_RT');

    this.httpOnly = configValidationUtility.convertToBoolean(
      this.configService.get('HTTP_ONLY'),
    ) as boolean;

    this.secure = configValidationUtility.convertToBoolean(
      this.configService.get('SECURE'),
    ) as boolean;

    this.sameSite = this.configService.get('SAME_SITE');

    this.maxAge = Number(this.configService.get('MAX_AGE'));

    this.path = this.configService.get('PATH');

    configValidationUtility.validateConfig(this);
  }

  getCookieConfig(): CookieOptions {
    return {
      httpOnly: this.httpOnly,
      secure: this.secure,
      sameSite: this.sameSite,
      maxAge: this.maxAge,
      path: this.path,
    };
  }
}
