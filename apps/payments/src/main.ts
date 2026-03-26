import { NestFactory } from '@nestjs/core';
import { PaymentsModule } from './payments.module';
import { ConfigService } from '@nestjs/config';
import { Configuration } from './setup/configuration/configuration';
import { ApiSettings } from './setup/configuration/api-settings';
import { EnvironmentSettings } from './setup/configuration/environment-settings';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(PaymentsModule);

  const configService: ConfigService<Configuration, true> = app.get(
    ConfigService<Configuration, true>,
  );
  const apiSettings: ApiSettings = configService.get<ApiSettings>('apiSettings');
  const environmentSettings: EnvironmentSettings =
    configService.get<EnvironmentSettings>('environmentSettings');

  const port: number = apiSettings.port;
  const env: string = environmentSettings.currentEnv;

  await app.listen(port, () => {
    logger.log(`\x1b[35m=========================================\x1b[0m`);
    logger.log(`\x1b[36m✅ Application is running in ${env} mode\x1b[0m`);
    logger.log(`\x1b[36m📡 Server listening on port ${port}\x1b[0m`);
    logger.log(`\x1b[36m🌍 Environment: ${env}\x1b[0m`);
    logger.log(`\x1b[35m=========================================\x1b[0m`);
  });
}

void bootstrap();
