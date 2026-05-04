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

function logSnapflowStartupBanner(
  appLogger: CustomLogger,
  params: { env: string; port: number },
): void {
  const { env, port } = params;
  const pid = process.pid;
  const r = '\x1b[0m';
  const bold = '\x1b[1m';
  const dim = '\x1b[2m';
  const cyan = '\x1b[36m';
  const mag = '\x1b[35m';
  const grn = '\x1b[32m';
  const ylw = '\x1b[33m';

  const inner = 58;

  const boxRow = (content: string): string => {
    const pad = Math.max(0, inner - stripAnsi(content).length);

    return `${cyan}│${r}${content}${' '.repeat(pad)}${cyan}│${r}`;
  };

  const hr = `${cyan}${'─'.repeat(inner)}${r}`;
  const title = `${bold}${mag}SNAPFLOW${r}${dim} · ${r}${bold}${mag}CORE${r}`;
  const subtitle = `${dim}NestJS · PostgreSQL · Prisma · RabbitMQ · Redis${r}`;

  const lines: string[] = [
    '',
    `${cyan}╭${hr}${cyan}╮${r}`,
    boxRow(''),
    boxRow(centerVisual(title, inner)),
    boxRow(centerVisual(subtitle, inner)),
    boxRow(''),
    `${cyan}├${hr}${cyan}┤${r}`,
    boxRow(`  ${grn}▸${r}  ${bold}environment${r}${dim}:${r}   ${ylw}${env}${r}`),
    boxRow(`  ${grn}▸${r}  ${bold}listen${r}${dim}:${r}        ${dim}http://${r}${ylw}0.0.0.0:${String(port)}${r}`),
    boxRow(`  ${grn}▸${r}  ${bold}pid${r}${dim}:${r}           ${dim}${pid}${r}`),
    `${cyan}╰${hr}${cyan}╯${r}`,
    '',
  ];

  for (const line of lines) {
    appLogger.log(line, 'bootstrap');
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

  const server: Express = app.getHttpAdapter().getInstance();
  server.set('trust proxy', true);

  await applyAppInitialization(app, appLogger);

  const port: number = apiSettings.port;
  const env: string = environmentSettings.currentEnv;

  await app.listen(port, () => {
    CustomLogger.enterBannerPhase();
    logSnapflowStartupBanner(appLogger, { env, port });
    CustomLogger.enterRuntimePhase();
  });
}

void bootstrap();
