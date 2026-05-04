/* eslint-disable @typescript-eslint/no-require-imports -- New Relic must load before any other imports */
require('newrelic');
/* eslint-enable @typescript-eslint/no-require-imports */

import { NestFactory } from '@nestjs/core';
import { initSnapFlowCoreAppModule } from './init-snap-flow-core-app-module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ApiSettings } from './setup/configuration/api-settings';
import { EnvironmentSettings } from './setup/configuration/environment-settings';
import { Configuration } from './setup/configuration/configuration';
import { Express } from 'express';
import { applyAppInitialization } from './setup/app-initialization';
import { CustomLogger } from './modules/logger/logger.service';
import { SwaggerSettings } from './setup/configuration/swagger-settings';
import { GLOBAL_PREFIX } from '../../../libs/common/constants/global-prefix.constant';

function joinPublicApiPath(base: string, ...segments: string[]): string {
  const root = base.replace(/\/+$/, '');
  const path = segments
    .map((s) => s.replace(/^\/+/, '').replace(/\/+$/, ''))
    .filter((s) => s.length > 0)
    .join('/');

  return path.length > 0 ? `${root}/${path}` : root;
}

/** В баннере: публичный origin или bind-URL для локальной отладки. */
function resolvePublicApiBaseUrlForBanner(apiSettings: ApiSettings, port: number): string {
  const fromEnv = apiSettings.publicApiBaseUrl;

  if (fromEnv !== undefined && fromEnv.length > 0) {
    return fromEnv.replace(/\/+$/, '');
  }

  return `http://0.0.0.0:${port}`;
}

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

function centerVisual(text: string, width: number): string {
  const visible = stripAnsi(text);
  const pad = Math.max(0, width - visible.length);
  const left = Math.floor(pad / 2);
  const right = pad - left;

  return `${' '.repeat(left)}${text}${' '.repeat(right)}`;
}

/**
 * Баннер в сыром stdout: без Winston (без timestamp/JSON) и без Nest-обёртки.
 * New Relic при `application_logging` подхватит `console` отдельно, если агент это пересылает.
 *
 * Логотип: монограмма **SF** (Snapflow) из псевдографики — как motd у Linux.
 */
function printSnapflowStartupBannerToConsole(params: {
  env: string;
  listenUrl: string;
  swaggerDocUrl: string;
}): void {
  const { env, listenUrl, swaggerDocUrl } = params;
  const pid = process.pid;
  const r = '\x1b[0m';
  const bold = '\x1b[1m';
  const dim = '\x1b[2m';
  const cyan = '\x1b[36m';
  const mag = '\x1b[35m';
  const grn = '\x1b[32m';
  const ylw = '\x1b[33m';

  /** Поле между рамкой │ … │ (узкий banner под стандартные 80 колонок). */
  const W = 62;
  /** Центрирование всего блока в «типичном» терминале motd. */
  const MOTD_COLS = 80;
  const motdLine = (s: string): string => centerVisual(s, MOTD_COLS);

  const boxRow = (content: string): string => {
    const pad = Math.max(0, W - stripAnsi(content).length);

    return `${cyan}│${r}${content}${' '.repeat(pad)}${cyan}│${r}`;
  };

  const hrPlain = '─'.repeat(W);

  const sfMark = [
    ' ███████╗ ███████╗ ',
    ' ██╔════╝ ██╔════╝ ',
    ' ███████╗ █████╗   ',
    ' ╚════██║ ██╔══╝   ',
    ' ███████║ ██║      ',
    ' ╚══════╝ ╚═╝      ',
  ];

  const title = `${bold}${mag}SNAPFLOW${r} ${dim}·${r} ${bold}${mag}CORE${r}`;
  const subtitle = `${dim}NestJS · PostgreSQL · Prisma · RabbitMQ · Redis${r}`;

  const lines: string[] = [
    '',
    motdLine(`${cyan}╭${hrPlain}╮${r}`),
    motdLine(boxRow('')),
    ...sfMark.map((row) => motdLine(boxRow(centerVisual(`${bold}${mag}${row}${r}`, W)))),
    motdLine(boxRow('')),
    motdLine(boxRow(centerVisual(title, W))),
    motdLine(boxRow(centerVisual(subtitle, W))),
    motdLine(boxRow('')),
    motdLine(`${cyan}├${hrPlain}┤${r}`),
    motdLine(boxRow(`  ${grn}▸${r}  ${bold}environment${r}${dim}:${r}   ${ylw}${env}${r}`)),
    motdLine(boxRow(`  ${grn}▸${r}  ${bold}listen${r}${dim}:${r}        ${ylw}${listenUrl}${r}`)),
    motdLine(
      boxRow(`  ${grn}▸${r}  ${bold}swagger${r}${dim}:${r}       ${ylw}${swaggerDocUrl}${r}`),
    ),

    motdLine(boxRow(`  ${grn}▸${r}  ${bold}pid${r}${dim}:${r}           ${dim}${pid}${r}`)),
    motdLine(`${cyan}╰${hrPlain}╯${r}`),
    '',
  ];

  for (const line of lines) {
    // eslint-disable-next-line no-console -- нарочный баннер в TTY, не через winston
    console.log(line);
  }
}

async function bootstrap() {
  const DynamicAppModule = await initSnapFlowCoreAppModule();

  const app = await NestFactory.create<NestExpressApplication>(DynamicAppModule, {
    bufferLogs: true,
  });

  const appLogger: CustomLogger = await app.resolve(CustomLogger);
  appLogger.setContext('NEST_INIT');
  app.useLogger(appLogger);

  const configService: ConfigService<Configuration, true> = app.get(
    ConfigService<Configuration, true>,
  );
  const apiSettings: ApiSettings = configService.get<ApiSettings>('apiSettings');
  const environmentSettings: EnvironmentSettings =
    configService.get<EnvironmentSettings>('environmentSettings');
  const swaggerSettings: SwaggerSettings = configService.get<SwaggerSettings>('swaggerSettings');

  const server: Express = app.getHttpAdapter().getInstance();
  server.set('trust proxy', true);

  await applyAppInitialization(app, appLogger);

  const port: number = apiSettings.port;
  const env: string = environmentSettings.currentEnv;
  const publicApiBase: string = resolvePublicApiBaseUrlForBanner(apiSettings, port);
  const swaggerDocUrl: string = joinPublicApiPath(
    publicApiBase,
    GLOBAL_PREFIX,
    swaggerSettings.swaggerPath,
  );

  await app.listen(port, () => {
    printSnapflowStartupBannerToConsole({ env, listenUrl: publicApiBase, swaggerDocUrl });
    setImmediate(() => {
      CustomLogger.enterRuntimePhase();
    });
  });
}

void bootstrap();
