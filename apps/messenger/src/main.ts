import { NestFactory } from '@nestjs/core';
import { MessengerModule } from './messenger.module';
import { printMessengerStartupBannerToConsole } from './modules/logger/utils/startup-banner.util';
import { applyAppInitialization } from './setup/app-initialization';
import { ApiSettings } from './setup/configuration/api-settings';
import { EnvironmentSettings } from './setup/configuration/environment-settings';
import { Configuration } from './setup/configuration/configuration';
import { ConfigService } from '@nestjs/config';
import { CustomLogger } from './modules/logger/logger.service';

async function bootstrap() {
  const app = await NestFactory.create(MessengerModule, {
    rawBody: true,
    bufferLogs: true,
  });

  app.useLogger(app.get(CustomLogger));

  const configService: ConfigService<Configuration, true> = app.get(
    ConfigService<Configuration, true>,
  );
  const environmentSettings: EnvironmentSettings =
    configService.get<EnvironmentSettings>('environmentSettings');
  const { port }: ApiSettings = configService.get<ApiSettings>('apiSettings');

  applyAppInitialization(app);

  const env: string = environmentSettings.currentEnv;

  await app.listen(port, () => {
    const startedAt: string = new Date().toLocaleString();
    printMessengerStartupBannerToConsole({
      env,
      port,
      startedAt,
    });
  });
}
bootstrap();
