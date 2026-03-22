import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsString, IsUrl } from 'class-validator';
import { CookieOptions } from 'express';
import { EnvironmentVariable } from './configuration';

export enum SameSite {
  STRICT = 'strict',
  LAX = 'lax',
  NONE = 'none',
}

export class ApiSettings {
  @IsNumber()
  port: number;

  @IsNotEmpty()
  accessTokenSecret: string;

  @IsNotEmpty()
  refreshTokenSecret: string;

  @IsNotEmpty()
  accessTokenExpireIn: string | number;

  @IsNotEmpty()
  refreshTokenExpireIn: string | number;

  @IsNotEmpty()
  googleClientId: string;

  @IsNotEmpty()
  googleClientSecret: string;

  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  googleCallbackUrl: string;

  @IsNotEmpty()
  githubOauthClientId: string;

  @IsNotEmpty()
  githubOauthClientSecret: string;

  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  githubOauthCallbackUrl: string;

  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  redirectFrontUrl: string;

  @IsNotEmpty()
  googleRecaptchaSecretKey: string;

  @IsBoolean()
  httpOnly: boolean;

  @IsBoolean()
  secure: boolean;

  @IsEnum(SameSite)
  sameSite: SameSite;

  @IsNumber()
  maxAge: number;

  @IsString()
  allowedOriginsRaw: string;

  @IsNumber()
  throttleTtl: number;

  @IsNumber()
  throttleLimit: number;

  @IsBoolean()
  isSwaggerEnabled: boolean;

  @IsBoolean()
  sendInternalServerErrorDetails: boolean;

  @IsUrl()
  redisUrl: string;

  @IsString()
  nextjsRevalidationSecret: string;

  @IsUrl()
  revalidationFrontendUrl: string;

  constructor(private readonly environmentVariables: EnvironmentVariable) {
    this.port = Number(environmentVariables.PORT);

    this.accessTokenSecret = environmentVariables.JWT_SECRET_AT;
    this.refreshTokenSecret = environmentVariables.JWT_SECRET_RT;
    this.accessTokenExpireIn = environmentVariables.JWT_EXPIRATION_AT;
    this.refreshTokenExpireIn = environmentVariables.JWT_EXPIRATION_RT;

    this.googleClientId = environmentVariables.GOOGLE_CLIENT_ID;
    this.googleClientSecret = environmentVariables.GOOGLE_CLIENT_SECRET;
    this.googleCallbackUrl = environmentVariables.GOOGLE_CALLBACK_URL;

    this.githubOauthClientId = environmentVariables.GITHUB_OAUTH_CLIENT_ID;
    this.githubOauthClientSecret = environmentVariables.GITHUB_OAUTH_CLIENT_SECRET;
    this.githubOauthCallbackUrl = environmentVariables.GITHUB_OAUTH_CALLBACK_URL;

    this.redirectFrontUrl = environmentVariables.REDIRECT_FRONT_URL;

    this.googleRecaptchaSecretKey = environmentVariables.GOOGLE_RECAPTCHA_SECRET_KEY;

    this.httpOnly = environmentVariables.HTTP_ONLY === 'true';
    this.secure = environmentVariables.SECURE === 'true';
    this.sameSite = environmentVariables.SAME_SITE as SameSite;
    this.maxAge = Number(environmentVariables.MAX_AGE);

    this.allowedOriginsRaw = environmentVariables.ALLOWED_ORIGINS;

    this.throttleTtl = Number(environmentVariables.THROTTLE_TTL);
    this.throttleLimit = Number(environmentVariables.THROTTLE_LIMIT);

    this.isSwaggerEnabled = environmentVariables.IS_SWAGGER_ENABLED === 'true';

    this.sendInternalServerErrorDetails =
      environmentVariables.SEND_INTERNAL_SERVER_ERROR_DETAILS === 'true';

    this.redisUrl = environmentVariables.REDIS_URL;

    this.nextjsRevalidationSecret = environmentVariables.NEXTJS_REVALIDATION_SECRET;
    this.revalidationFrontendUrl = environmentVariables.REVALIDATION_FRONTEND_URL;
  }

  getJwtOptions() {
    return {
      accessToken: {
        secret: this.accessTokenSecret,
        expiresIn: this.accessTokenExpireIn,
      },
      refreshToken: {
        secret: this.refreshTokenSecret,
        expiresIn: this.refreshTokenExpireIn,
      },
    };
  }

  getGoogleOauthOptions() {
    return {
      clientID: this.googleClientId,
      clientSecret: this.googleClientSecret,
      callbackURL: this.googleCallbackUrl,
    };
  }

  getGithubOauthOptions() {
    return {
      clientID: this.githubOauthClientId,
      clientSecret: this.githubOauthClientSecret,
      callbackURL: this.githubOauthCallbackUrl,
    };
  }

  getCookieOptions(): CookieOptions {
    return {
      httpOnly: this.httpOnly,
      secure: this.secure,
      sameSite: this.sameSite,
      maxAge: this.maxAge,
    };
  }

  getThrottleOptions() {
    return {
      ttl: this.throttleTtl,
      limit: this.throttleLimit,
    };
  }

  get allowedOrigins(): string[] | boolean {
    if (this.allowedOriginsRaw === '*' || this.allowedOriginsRaw === 'true') {
      return true;
    }
    return this.allowedOriginsRaw.split(',').map((item) => item.trim());
  }
}
