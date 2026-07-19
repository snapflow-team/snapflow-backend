import { NestFactory } from '@nestjs/core';
import { MessengerModule } from './messenger.module';
import { printMessengerStartupBannerToConsole } from './modules/logger/utils/startup-banner.util';
import { applyAppInitialization } from './setup/app-initialization';
import { SocketIoCorsAdapter } from './setup/socket-io-cors.adapter';
import { ApiSettings } from './setup/configuration/api-settings';
import { EnvironmentSettings } from './setup/configuration/environment-settings';
import { Configuration } from './setup/configuration/configuration';
import { ConfigService } from '@nestjs/config';
import { CustomLogger } from './modules/logger/logger.service';
import { REDIS_CLIENT_INJECT_TOKEN } from './core/providers/provide-tokens/redis-client.inject-token';
import { Redis } from 'ioredis';
import { SwaggerSettings } from './setup/configuration/swagger-settings';
import { GLOBAL_PREFIX } from '../../../libs/common/constants/global-prefix.constant';

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
  const apiSettings: ApiSettings = configService.get<ApiSettings>('apiSettings');
  const { port, publicApiBaseUrl, allowedOrigins } = apiSettings;
  const { swaggerPath }: SwaggerSettings = configService.get<SwaggerSettings>('swaggerSettings');

  applyAppInitialization(app);

  const redisClient: Redis = app.get(REDIS_CLIENT_INJECT_TOKEN);

  const ioAdapter = new SocketIoCorsAdapter(app, allowedOrigins);
  await ioAdapter.connectToRedis(redisClient);
  app.useWebSocketAdapter(ioAdapter);

  const env: string = environmentSettings.currentEnv;
  const swaggerDocUrl: string = `${publicApiBaseUrl}/${GLOBAL_PREFIX}/${swaggerPath}`;
  const showSwaggerInBanner: boolean =
    environmentSettings.isDevelopment || environmentSettings.isStaging;

  await app.listen(port, () => {
    const startedAt: string = new Date().toLocaleString();
    printMessengerStartupBannerToConsole({
      env,
      port,
      swaggerDocUrl,
      startedAt,
      showSwagger: showSwaggerInBanner,
    });
  });
}
void bootstrap();
