import { IsBoolean, IsNotEmpty, IsNumber, IsString, IsUrl } from 'class-validator';
import { EnvironmentVariable } from './configuration';

export class ApiSettings {
  @IsNumber()
  port: number;

  @IsNotEmpty()
  accessTokenSecret: string;

  @IsNotEmpty()
  accessTokenExpireIn: string | number;

  @IsString()
  allowedOriginsRaw: string;

  @IsBoolean()
  sendInternalServerErrorDetails: boolean;

  @IsUrl({
    protocols: ['redis', 'rediss'],
    require_tld: false,
  })
  redisUrl: string;

  constructor(private readonly environmentVariables: EnvironmentVariable) {
    this.port = Number(environmentVariables.PORT);

    this.accessTokenSecret = environmentVariables.JWT_SECRET_AT;
    this.accessTokenExpireIn = environmentVariables.JWT_EXPIRATION_AT;

    this.allowedOriginsRaw = environmentVariables.ALLOWED_ORIGINS;

    this.sendInternalServerErrorDetails =
      environmentVariables.SEND_INTERNAL_SERVER_ERROR_DETAILS === 'true';

    this.redisUrl = environmentVariables.REDIS_URL;
  }

  getJwtOptions() {
    return {
      accessToken: {
        secret: this.accessTokenSecret,
        expiresIn: this.accessTokenExpireIn,
      },
    };
  }
}
