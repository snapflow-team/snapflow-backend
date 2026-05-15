import { IsBoolean, IsNumber, IsString, IsUrl } from 'class-validator';
import { EnvironmentVariable } from './configuration';

export class ApiSettings {
  @IsNumber()
  port: number;

  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  publicApiBaseUrl: string;

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

  @IsString()
  stripeSecretKey: string;

  @IsString()
  stripeWebhookSecret: string;

  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  stripeSuccessUrl: string;

  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  stripeCancelUrl: string;

  constructor(private readonly environmentVariables: EnvironmentVariable) {
    this.port = Number(environmentVariables.PORT);

    this.publicApiBaseUrl = environmentVariables.PUBLIC_API_BASE_URL;

    this.coreServiceUrl = environmentVariables.CORE_SERVICE_URL;

    this.allowedOriginsRaw = environmentVariables.ALLOWED_ORIGINS;

    this.sendInternalServerErrorDetails =
      environmentVariables.SEND_INTERNAL_SERVER_ERROR_DETAILS === 'true';

    this.redisUrl = environmentVariables.REDIS_URL;

    this.rabbitMqUrl = environmentVariables.RABBITMQ_URL;

    this.stripeSecretKey = environmentVariables.STRIPE_SECRET_KEY;
    this.stripeWebhookSecret = environmentVariables.STRIPE_WEBHOOK_SECRET;
    this.stripeSuccessUrl = environmentVariables.STRIPE_SUCCESS_URL;
    this.stripeCancelUrl = environmentVariables.STRIPE_CANCEL_URL;
  }

  get allowedOrigins(): string[] | boolean {
    if (this.allowedOriginsRaw === '*' || this.allowedOriginsRaw === 'true') {
      return true;
    }
    return this.allowedOriginsRaw.split(',').map((item) => item.trim());
  }
}
