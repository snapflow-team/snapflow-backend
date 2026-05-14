import { NestFactory } from '@nestjs/core';
import { PaymentsModule } from './payments.module';
import { ConfigService } from '@nestjs/config';
import { Configuration } from './setup/configuration/configuration';
import { ApiSettings } from './setup/configuration/api-settings';
import { EnvironmentSettings } from './setup/configuration/environment-settings';
import { applyAppInitialization } from './setup/app-initialization';
import { CustomLogger } from './modules/logger/logger.service';
import { SwaggerSettings } from './setup/configuration/swagger-settings';
import { GLOBAL_PREFIX } from '../../../libs/common/constants/global-prefix.constant';
import { printPaymentsStartupBannerToConsole } from './modules/logger/utils/startup-banner.util';

async function bootstrap() {
  const app = await NestFactory.create(PaymentsModule, {
    rawBody: true,
    bufferLogs: true,
  });

  app.useLogger(app.get(CustomLogger));

  const configService: ConfigService<Configuration, true> = app.get(
    ConfigService<Configuration, true>,
  );
  const apiSettings: ApiSettings = configService.get<ApiSettings>('apiSettings');
  const environmentSettings: EnvironmentSettings =
    configService.get<EnvironmentSettings>('environmentSettings');
  const swaggerSettings: SwaggerSettings = configService.get<SwaggerSettings>('swaggerSettings');

  applyAppInitialization(app);

  const port: number = apiSettings.port;
  const env: string = environmentSettings.currentEnv;

  await app.listen(port, () => {
    const startedAt: string = new Date().toLocaleString();
    const swaggerDocUrl: string = `http://localhost:${port}/${GLOBAL_PREFIX}/${swaggerSettings.swaggerPath}`;
    printPaymentsStartupBannerToConsole({
      env,
      port,
      swaggerDocUrl,
      startedAt,
      showSwagger: environmentSettings.isDevelopment,
    });
  });
}

void bootstrap();
