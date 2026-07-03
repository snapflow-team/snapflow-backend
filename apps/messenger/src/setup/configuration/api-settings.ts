import { IsBoolean, IsNumber, IsString, IsUrl } from 'class-validator';
import { EnvironmentVariable } from './configuration';

export class ApiSettings {
  @IsNumber()
  port: number;

  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  coreServiceUrl: string;

  @IsString()
  allowedOriginsRaw: string;

  @IsBoolean()
  sendInternalServerErrorDetails: boolean;

  @IsUrl({
    protocols: ['redis', 'rediss'],
    require_tld: false,
  })
  redisUrl: string;

  @IsUrl({
    protocols: ['amqp', 'amqps'],
    require_tld: false,
  })
  rabbitMqUrl: string;

  constructor(private readonly environmentVariables: EnvironmentVariable) {
    this.port = Number(environmentVariables.PORT);

    this.coreServiceUrl = environmentVariables.CORE_SERVICE_URL;

    this.allowedOriginsRaw = environmentVariables.ALLOWED_ORIGINS;

    this.sendInternalServerErrorDetails =
      environmentVariables.SEND_INTERNAL_SERVER_ERROR_DETAILS === 'true';

    this.redisUrl = environmentVariables.REDIS_URL;

    this.rabbitMqUrl = environmentVariables.RABBITMQ_URL;
  }

  get allowedOrigins(): string[] | boolean {
    if (this.allowedOriginsRaw === '*' || this.allowedOriginsRaw === 'true') {
      return true;
    }
    return this.allowedOriginsRaw.split(',').map((item) => item.trim());
  }

  get redisDbUrl(): string {
    return this.environmentVariables.REDIS_URL;
  }
}
